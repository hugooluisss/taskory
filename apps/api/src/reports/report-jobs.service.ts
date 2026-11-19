import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { ReportJob } from "./entities/report-job.entity";
import { ReportJobsRepository } from "./report-jobs.repository";
import { ReportJobParams } from "./entities/report-job-params";
import { ReportMemoryRepository } from "./report-memory.repository";
import { ActiveReportExistsError } from "./errors/active-report-exists.error";

@Injectable()
export class ReportJobsService implements OnModuleDestroy {
  constructor(
    private readonly jobs: ReportJobsRepository,
    private readonly memory: ReportMemoryRepository,
  ) {}

  async recover(): Promise<ReportJob[]> {
    const interrupted = await this.jobs.findRunning();
    await this.jobs.markRunningInterrupted();
    return interrupted;
  }

  onModuleDestroy(): void {}

  async enqueue(
    userId: string,
    input: ReportJobParams,
    activityIds: string[],
    chunkSize: number,
    sharing?: { shareTokenHash: string; shareExpiresAt: Date },
  ): Promise<ReportJob> {
    try {
      return await this.jobs.create({
        userId,
        status: "queued",
        params: input,
        activityIds,
        chunkSize,
        progressDone: 0,
        progressTotal: Math.ceil(activityIds.length / chunkSize),
        markdown: null,
        provider: null,
        model: null,
        errorCode: null,
        errorChunk: null,
        finishedAt: null,
        ...sharing,
      });
    } catch (error) {
      if (error instanceof ActiveReportExistsError) {
        const active = await this.jobs.findActiveForUser(userId);
        throw new ApiException(409, ERROR_CODES.REPORT_IN_PROGRESS, {
          id: active?.id,
        });
      }
      throw error;
    }
  }

  createCompleted(userId: string, values: Partial<ReportJob>) {
    return this.jobs.create({ ...values, userId, status: "completed" });
  }

  list(userId: string, skip: number, take: number) {
    return this.jobs.list(userId, skip, take);
  }

  findByShareHash(hash: string) {
    return this.jobs.findByShareHash(hash);
  }

  async get(userId: string, id: string): Promise<ReportJob> {
    const job = await this.jobs.find(userId, id);
    if (!job) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    return job;
  }

  async retry(userId: string, id: string): Promise<ReportJob> {
    const job = await this.get(userId, id);
    if (job.status !== "failed")
      throw new ApiException(409, ERROR_CODES.REPORT_NOT_RETRYABLE);
    try {
      if (await this.jobs.retry(userId, id)) {
        return {
          ...job,
          status: "queued",
          errorCode: null,
          errorChunk: null,
          finishedAt: null,
        };
      }
      const current = await this.get(userId, id);
      if (current.status !== "failed")
        throw new ApiException(409, ERROR_CODES.REPORT_NOT_RETRYABLE);
      const active = await this.jobs.findActiveForUser(userId);
      throw new ApiException(409, ERROR_CODES.REPORT_IN_PROGRESS, {
        id: active?.id,
      });
    } catch (error) {
      if (error instanceof ActiveReportExistsError) {
        const active = await this.jobs.findActiveForUser(userId);
        throw new ApiException(409, ERROR_CODES.REPORT_IN_PROGRESS, {
          id: active?.id,
        });
      }
      throw error;
    }
  }

  listQueued() {
    return this.jobs.findQueued();
  }

  queuedForDispatch(userId: string, id: string) {
    return this.jobs.findQueuedJob(userId, id);
  }

  listMemory(userId: string, id: string) {
    return this.memory.list(userId, id);
  }

  saveMemory(
    userId: string,
    row: Parameters<ReportMemoryRepository["save"]>[1],
  ) {
    return this.memory.save(userId, row);
  }

  clearMemory(userId: string, id: string) {
    return this.memory.clear(userId, id);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await this.jobs.remove(userId, id);
  }

  async markRunning(job: ReportJob): Promise<void> {
    await this.jobs.update(job.userId, job.id, { status: "running" });
  }

  async update(
    userId: string,
    id: string,
    values: Partial<ReportJob>,
  ): Promise<void> {
    try {
      await this.jobs.update(userId, id, values);
    } catch (error) {
      if (!(error instanceof ActiveReportExistsError)) throw error;
      const active = await this.jobs.findActiveForUser(userId);
      throw new ApiException(409, ERROR_CODES.REPORT_IN_PROGRESS, {
        id: active?.id,
      });
    }
  }
}
