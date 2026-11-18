import { Inject, Injectable, Logger } from "@nestjs/common";
import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { isCalendarDate } from "../common/dates/is-calendar-date";
import {
  CHUNK_SIZE,
  reportActivityLimit,
  REPORT_SYNC_MAX_ACTIVITIES,
} from "./constants";
import { CreateReportDto } from "./dto/create-report.dto";
import { REPORT_GENERATOR } from "./report-generator.provider";
import { ReportGeneratorPort } from "./ports/report-generator.port";
import { ReportJobsService } from "./report-jobs.service";
import { REPORT_JOB_QUEUE, ReportJobQueue } from "./report-job-queue";
import { ReportGenerationError } from "./ports/report-generation-error";
import { messages } from "../common/i18n/messages";
import { ReportRunsRepository } from "./report-runs.repository";
import { reportCostMicros } from "./report-cost";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly activities: ActivitiesService,
    @Inject(REPORT_GENERATOR) private readonly generator: ReportGeneratorPort,
    private readonly jobs: ReportJobsService,
    @Inject(REPORT_JOB_QUEUE) private readonly queue: ReportJobQueue,
    private readonly runs: ReportRunsRepository,
  ) {}

  async create(userId: string, input: CreateReportDto) {
    if (
      !isCalendarDate(input.from) ||
      !isCalendarDate(input.to) ||
      input.from > input.to
    ) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!this.generator.hasProvider()) {
      throw new ApiException(502, ERROR_CODES.LLM_UNAVAILABLE);
    }
    const projectIds = [...new Set(input.projectIds ?? [])];
    const snapshot = await this.activities.findReportSnapshot(userId, {
      from: input.from,
      to: input.to,
      projectIds,
      tags: input.tags,
    });
    if (snapshot.length === 0) {
      throw new ApiException(422, ERROR_CODES.NO_ACTIVITIES);
    }
    if (snapshot.length > reportActivityLimit()) {
      throw new ApiException(422, ERROR_CODES.RANGE_TOO_LARGE);
    }
    if (snapshot.length > REPORT_SYNC_MAX_ACTIVITIES) {
      const job = await this.jobs.enqueue(
        userId,
        { ...input, style: input.style ?? "summary" },
        snapshot.map(({ id }) => id),
        CHUNK_SIZE,
      );
      this.queue.enqueue(job.id, userId);
      return {
        id: job.id,
        status: job.status,
        progress: { done: 0, total: job.progressTotal },
      };
    }
    const activities = await this.activities.findReportChunk(
      userId,
      snapshot.map(({ id }) => id),
    );
    let result: Awaited<ReturnType<ReportGeneratorPort["generate"]>>;
    try {
      result = await this.generator.generate({
        activities: activities.map((activity: Activity) => ({
          id: activity.id,
          date: activity.date,
          title: activity.title,
          description: activity.description,
          referenceUrls: activity.referenceUrls,
          tags: activity.tags,
          projects: activity.projects.map(({ id, name }) => ({ id, name })),
        })),
        from: input.from,
        to: input.to,
        projectIds,
        language: input.language,
        style: input.style ?? "summary",
      });
    } catch (error) {
      const configured = this.generator.configuration();
      const usage = usageOf(error);
      try {
        await this.runs.save({
          userId,
          jobId: null,
          from: input.from,
          to: input.to,
          projectIds,
          language: input.language,
          style: input.style ?? "summary",
          provider: configured.provider,
          model: configured.model,
          ...usage,
          costMicros: reportCostMicros(configured.provider, usage),
          activityCount: activities.length,
          status: "failed",
        });
      } catch (recordingError) {
        this.logger.error(
          "Failed to record failed report run",
          recordingError instanceof Error
            ? recordingError.stack
            : String(recordingError),
        );
      }
      if (error instanceof ReportGenerationError) {
        switch (error.code) {
          case "LLM_UNAVAILABLE":
          case "INVALID_LLM_OUTPUT":
            throw new ApiException(502, ERROR_CODES.LLM_UNAVAILABLE);
          default:
            throw error;
        }
      }
      throw error;
    }
    const costMicros = reportCostMicros(result.provider, result);
    await this.runs.save({
      userId,
      jobId: null,
      from: input.from,
      to: input.to,
      projectIds,
      language: input.language,
      style: input.style ?? "summary",
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      costMicros,
      activityCount: activities.length,
      status: "completed",
    });
    return {
      ...result,
      costUsd: costMicros / 1_000_000,
      activityCount: activities.length,
    };
  }

  listRuns(userId: string, page?: number, limit?: number) {
    return this.runs.list(userId, page, limit);
  }

  status(userId: string, id: string, acceptLanguage?: string) {
    const language = /^es(?:-|$)/i.test(acceptLanguage ?? "") ? "es" : "en";
    return this.jobs.get(userId, id).then((job) => ({
      id: job.id,
      status: job.status,
      progress: { done: job.progressDone, total: job.progressTotal },
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      ...(job.status === "completed"
        ? {
            markdown: job.markdown,
            provider: job.provider,
            model: job.model,
            totalTokens: job.totalTokens,
            promptTokens: job.promptTokens,
            completionTokens: job.completionTokens,
            costUsd: job.costMicros / 1_000_000,
            activityCount: job.activityIds.length,
          }
        : {}),
      ...(job.status === "failed"
        ? {
            error: {
              code: job.errorCode,
              chunk: job.errorChunk,
              message:
                messages[language][job.errorCode ?? ""] ??
                messages[language][ERROR_CODES.INTERNAL_ERROR],
            },
          }
        : {}),
    }));
  }

  retry(userId: string, id: string) {
    return this.jobs.retry(userId, id).then((job) => {
      this.queue.enqueue(id, userId);
      return {
        id: job.id,
        status: job.status,
        progress: { done: job.progressDone, total: job.progressTotal },
      };
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.jobs.get(userId, id);
    this.queue.cancel(id);
    try {
      await this.jobs.delete(userId, id);
    } finally {
      this.queue.finishCancellation(id);
    }
  }
}

function usageOf(error: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof error !== "object" || error === null)
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  if (
    "usage" in error &&
    typeof error.usage === "object" &&
    error.usage !== null
  ) {
    return normalizeUsage(error.usage);
  }
  return normalizeUsage(error);
}

function normalizeUsage(source: object): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const read = (key: string) => {
    const value = Number((source as Record<string, unknown>)[key]);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  };
  return {
    promptTokens: read("promptTokens"),
    completionTokens: read("completionTokens"),
    totalTokens: read("totalTokens"),
  };
}
