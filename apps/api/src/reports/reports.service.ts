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
  SHARE_EXPIRY_DAYS,
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
import { UsersService } from "../users/users.service";
import { reportStylePrompts } from "@taskory/llm";
import { createHash, randomBytes } from "node:crypto";
import { pagination } from "../common/pagination/pagination";
import { getWebPublicUrl } from "../config";
import { ReportJob } from "./entities/report-job.entity";
import { ReportJobParams } from "./entities/report-job-params";
import { RegenerateReportDto } from "./dto/regenerate-report.dto";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly activities: ActivitiesService,
    @Inject(REPORT_GENERATOR) private readonly generator: ReportGeneratorPort,
    private readonly jobs: ReportJobsService,
    @Inject(REPORT_JOB_QUEUE) private readonly queue: ReportJobQueue,
    private readonly runs: ReportRunsRepository,
    private readonly users: UsersService,
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
    const projects = await this.activities.findReportProjects(
      userId,
      snapshot.map(({ id }) => id),
      projectIds,
    );
    if (input.style === "custom") {
      const customPrompt = input.customPrompt?.trim();
      if (!customPrompt || customPrompt.length > 2000) {
        throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
      }
      input.customPrompt = customPrompt;
      await this.users.saveCustomReportPrompt(userId, customPrompt);
    }
    const params: ReportJobParams = {
      from: input.from,
      to: input.to,
      projectIds,
      tags: input.tags,
      language: input.language,
      style: input.style ?? "summary",
      projects,
      ...(input.style === "custom" ? { customPrompt: input.customPrompt } : {}),
    };
    const shareToken = randomBytes(32).toString("base64url");
    const shareTokenHash = hashToken(shareToken);
    const shareExpiresAt = new Date(Date.now() + SHARE_EXPIRY_DAYS * 86400000);
    if (snapshot.length > REPORT_SYNC_MAX_ACTIVITIES) {
      const job = await this.jobs.enqueue(
        userId,
        params,
        snapshot.map(({ id }) => id),
        CHUNK_SIZE,
        { shareTokenHash, shareExpiresAt },
      );
      this.queue.enqueue(job.id, userId);
      return {
        id: job.id,
        status: job.status,
        progress: { done: 0, total: job.progressTotal },
        shareUrl: `${getWebPublicUrl()}/shared/${shareToken}`,
        shareExpiresAt,
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
        projects,
        language: input.language,
        style: input.style ?? "summary",
        ...(input.style === "custom"
          ? { customPrompt: input.customPrompt }
          : {}),
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
    const completed = await this.jobs.createCompleted(userId, {
      params,
      activityIds: snapshot.map(({ id }) => id),
      chunkSize: CHUNK_SIZE,
      progressDone: 1,
      progressTotal: 1,
      markdown: result.markdown,
      provider: result.provider,
      model: result.model,
      ...resultUsage(result),
      costMicros,
      finishedAt: new Date(),
      shareTokenHash,
      shareExpiresAt,
      errorCode: null,
      errorChunk: null,
    });
    await this.runs.save({
      userId,
      jobId: completed.id,
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
      id: completed.id,
      ...result,
      costUsd: costMicros / 1_000_000,
      activityCount: activities.length,
      shareUrl: `${getWebPublicUrl()}/shared/${shareToken}`,
      shareExpiresAt,
    };
  }

  async list(userId: string, page?: number, limit?: number) {
    const paging = pagination(page, limit);
    const [jobs, total] = await this.jobs.list(
      userId,
      paging.skip,
      paging.limit,
    );
    return {
      items: jobs.map((job) => this.summary(job)),
      total,
      page: paging.page,
      limit: paging.limit,
    };
  }

  async detail(userId: string, id: string, acceptLanguage?: string) {
    const job = await this.jobs.get(userId, id);
    const language = /^es(?:-|$)/i.test(acceptLanguage ?? "") ? "es" : "en";
    return {
      ...this.summary(job),
      promptTokens: job.promptTokens,
      completionTokens: job.completionTokens,
      markdown: job.markdown,
      ...(job.params.style === "custom"
        ? { customPrompt: job.params.customPrompt }
        : {}),
      progress: { done: job.progressDone, total: job.progressTotal },
      ...(job.errorCode
        ? {
            error: {
              code: job.errorCode,
              chunk: job.errorChunk,
              message:
                messages[language][job.errorCode] ??
                messages[language][ERROR_CODES.INTERNAL_ERROR],
            },
          }
        : {}),
      shareExpiresAt: job.shareExpiresAt,
    };
  }

  async renewShare(userId: string, id: string) {
    const job = await this.jobs.get(userId, id);
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + SHARE_EXPIRY_DAYS * 86400000);
    await this.jobs.update(userId, id, {
      shareTokenHash: hashToken(token),
      shareExpiresAt: expires,
    });
    return {
      shareUrl: `${getWebPublicUrl()}/shared/${token}`,
      shareExpiresAt: expires,
    };
  }

  async regenerate(userId: string, id: string, input: RegenerateReportDto) {
    const job = await this.jobs.get(userId, id);
    if (job.status === "queued" || job.status === "running")
      throw new ApiException(409, ERROR_CODES.REPORT_IN_PROGRESS);
    if (!this.generator.hasProvider())
      throw new ApiException(502, ERROR_CODES.LLM_UNAVAILABLE);
    let customPrompt: string | undefined;
    if (input.style === "custom") {
      customPrompt = input.customPrompt?.trim();
      if (!customPrompt || customPrompt.length > 2000)
        throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
      await this.users.saveCustomReportPrompt(userId, customPrompt);
    }
    const priorParams = { ...job.params };
    delete priorParams.customPrompt;
    const params = {
      ...priorParams,
      style: input.style,
      language: input.language ?? job.params.language,
      ...(input.style === "custom" ? { customPrompt } : {}),
    };
    await this.jobs.clearMemory(userId, id);
    try {
      await this.jobs.update(userId, id, {
        params,
        status: "queued",
        markdown: null,
        errorCode: null,
        errorChunk: null,
        progressDone: 0,
        progressTotal: Math.ceil(job.activityIds.length / job.chunkSize),
        finishedAt: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costMicros: 0,
      });
      this.queue.enqueue(id, userId);
    } catch (error) {
      throw error;
    }
    return {
      id,
      status: "queued",
      progress: {
        done: 0,
        total: Math.ceil(job.activityIds.length / job.chunkSize),
      },
    };
  }

  private summary(job: ReportJob) {
    return {
      id: job.id,
      status: job.status,
      from: job.params.from,
      to: job.params.to,
      language: job.params.language,
      style: job.params.style,
      projects:
        job.params.projects?.map(({ id, name }) => ({ id, name })) ?? [],
      activityCount: job.activityIds.length,
      provider: job.provider,
      model: job.model,
      totalTokens: job.totalTokens,
      costUsd: job.costMicros / 1_000_000,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    };
  }

  listRuns(userId: string, page?: number, limit?: number) {
    return this.runs.list(userId, page, limit);
  }

  async listStyles(userId: string) {
    const user = await this.users.findById(userId);
    return {
      styles: [
        { id: "summary", prompt: reportStylePrompts.summary },
        { id: "detailed", prompt: reportStylePrompts.detailed },
      ],
      customPrompt: user?.customReportPrompt ?? null,
    };
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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function resultUsage(result: {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}) {
  return {
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
  };
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
