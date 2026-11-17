import { Inject, Injectable } from "@nestjs/common";
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

@Injectable()
export class ReportsService {
  constructor(
    private readonly activities: ActivitiesService,
    @Inject(REPORT_GENERATOR) private readonly generator: ReportGeneratorPort,
    private readonly jobs: ReportJobsService,
    @Inject(REPORT_JOB_QUEUE) private readonly queue: ReportJobQueue,
  ) {}

  listProviders() {
    return this.generator.listProviders();
  }

  async create(userId: string, input: CreateReportDto) {
    if (
      !isCalendarDate(input.from) ||
      !isCalendarDate(input.to) ||
      input.from > input.to
    ) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!this.generator.hasProvider(input.provider)) {
      throw new ApiException(400, ERROR_CODES.UNKNOWN_PROVIDER);
    }
    const snapshot = await this.activities.findReportSnapshot(userId, {
      from: input.from,
      to: input.to,
      project: input.project,
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
    try {
      const result = await this.generator.generate({
        activities: activities.map((activity: Activity) => ({
          id: activity.id,
          date: activity.date,
          title: activity.title,
          description: activity.description,
          referenceUrls: activity.referenceUrls,
          tags: activity.tags,
          project: activity.project,
        })),
        from: input.from,
        to: input.to,
        project: input.project,
        language: input.language,
        provider: input.provider,
        model: input.model,
        style: input.style ?? "summary",
      });
      return { ...result, activityCount: activities.length };
    } catch (error) {
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
