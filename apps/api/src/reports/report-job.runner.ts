import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { ERROR_CODES } from "../common/errors/error-codes";
import { ReportJob } from "./entities/report-job.entity";
import { ReportMemory } from "./entities/report-memory.entity";
import { ReportGeneratorPort } from "./ports/report-generator.port";
import { ReportTotals } from "./ports/report-totals";
import { REPORT_GENERATOR } from "./report-generator.provider";
import { REPORT_GLOBAL_CONCURRENCY } from "./constants";
import { ReportJobsService } from "./report-jobs.service";
import { ReportGenerationError } from "./ports/report-generation-error";
import { ReportJobQueue, REPORT_JOB_QUEUE } from "./report-job-queue";
import { ReportNotFoundForMemoryError } from "./errors/report-not-found-for-memory.error";

interface QueuedReport {
  id: string;
  userId: string;
  controller: AbortController;
}

@Injectable()
export class ReportJobRunner implements ReportJobQueue, OnApplicationBootstrap {
  private readonly queue: QueuedReport[] = [];
  private readonly active = new Map<string, AbortController>();
  private readonly cancelling = new Set<string>();
  private readonly tasks = new Set<Promise<void>>();
  private readonly logger = new Logger(ReportJobRunner.name);
  private running = 0;

  constructor(
    private readonly lifecycle: ReportJobsService,
    private readonly activities: ActivitiesService,
    @Inject(REPORT_GENERATOR) private readonly generator: ReportGeneratorPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.lifecycle.recover();
    await this.resumeQueued();
  }

  enqueue(id: string, userId: string): void {
    if (
      this.cancelling.has(id) ||
      this.queue.some((item) => item.id === id) ||
      this.active.has(id)
    )
      return;
    this.queue.push({ id, userId, controller: new AbortController() });
    this.pump();
  }

  async resumeQueued(): Promise<void> {
    for (const job of await this.repositoryQueued())
      this.enqueue(job.id, job.userId);
  }

  async awaitIdle(): Promise<void> {
    while (this.tasks.size > 0) {
      await Promise.all([...this.tasks]);
    }
  }

  cancel(id: string): void {
    this.cancelling.add(id);
    const queuedIndex = this.queue.findIndex((job) => job.id === id);
    if (queuedIndex !== -1) {
      this.queue.splice(queuedIndex, 1)[0].controller.abort();
    }
    this.active.get(id)?.abort();
  }

  finishCancellation(id: string): void {
    this.cancelling.delete(id);
  }

  private pump(): void {
    while (this.running < REPORT_GLOBAL_CONCURRENCY && this.queue.length) {
      const item = this.queue.shift()!;
      this.running += 1;
      const { controller } = item;
      this.active.set(item.id, controller);
      const task = this.run(item.id, item.userId, controller.signal)
        .catch(() => {
          this.logger.error(
            `Failed to persist report job ${item.id}; releasing its runner slot.`,
          );
        })
        .finally(async () => {
          this.active.delete(item.id);
          this.running -= 1;
          try {
            await this.resumeQueued();
          } catch {
            this.logger.error(
              `Failed to reload queued reports after job ${item.id}; releasing its runner slot.`,
            );
          } finally {
            this.pump();
          }
        });
      this.tasks.add(task);
      void task.then(
        () => this.tasks.delete(task),
        () => this.tasks.delete(task),
      );
    }
  }

  private async run(
    id: string,
    userId: string,
    signal: AbortSignal,
  ): Promise<void> {
    let currentChunk: number | null = null;
    try {
      const job = await this.lifecycle.queuedForDispatch(userId, id);
      if (!job || signal.aborted || this.cancelling.has(id)) return;
      await this.lifecycle.markRunning(job);
      if (signal.aborted || this.cancelling.has(id)) return;
      const memory = await this.lifecycle.listMemory(userId, id);
      const completeMemory = await this.evaluateRemainingChunks(
        job,
        memory,
        (index) => {
          currentChunk = index;
        },
        signal,
      );
      if (signal.aborted || this.cancelling.has(id)) return;
      currentChunk = null;
      await this.writeFinalReport(job, completeMemory, signal);
    } catch (error) {
      if (
        !signal.aborted &&
        !this.cancelling.has(id) &&
        !isCancellation(error)
      ) {
        await this.failJob(userId, id, error, currentChunk);
      }
    }
  }

  private async evaluateRemainingChunks(
    job: ReportJob,
    memory: ReportMemory[],
    setCurrentChunk: (index: number) => void,
    signal: AbortSignal,
  ): Promise<ReportMemory[]> {
    const chunks = this.chunkIds(job);
    for (let index = 0; index < chunks.length; index += 1) {
      if (memory.some((item) => item.chunkIndex === index)) continue;
      if (signal.aborted || this.cancelling.has(job.id)) return memory;
      setCurrentChunk(index);
      const rows = await this.loadChunkActivities(job.userId, chunks[index]);
      if (signal.aborted || this.cancelling.has(job.id)) return memory;
      const chunkMemory = rows.length
        ? await this.evaluateChunk(job, index, rows, signal)
        : this.emptyChunkMemory(job, index);
      if (signal.aborted || this.cancelling.has(job.id)) return memory;
      await this.lifecycle.saveMemory(job.userId, chunkMemory);
      memory.push(chunkMemory);
      await this.lifecycle.update(job.userId, job.id, {
        progressDone: memory.length,
      });
    }
    return memory.sort((first, second) => first.chunkIndex - second.chunkIndex);
  }

  private async evaluateChunk(
    job: ReportJob,
    chunkIndex: number,
    rows: Activity[],
    signal?: AbortSignal,
  ): Promise<ReportMemory> {
    const evaluated = await this.generator.evaluateChunk({
      activities: rows.map(toReportActivity),
      language: job.params.language,
      provider: job.params.provider,
      model: job.params.model,
      signal,
    });
    const chunkTotals = totals(rows);
    return {
      reportId: job.id,
      userId: job.userId,
      chunkIndex,
      dateFrom: rows[0].date,
      dateTo: rows[rows.length - 1].date,
      activityCount: rows.length,
      summary: evaluated.summary,
      highlights: evaluated.highlights,
      byProject: chunkTotals.byProject,
      byDay: chunkTotals.byDay,
    };
  }

  private emptyChunkMemory(job: ReportJob, chunkIndex: number): ReportMemory {
    return {
      reportId: job.id,
      userId: job.userId,
      chunkIndex,
      dateFrom: job.params.from,
      dateTo: job.params.to,
      activityCount: 0,
      summary: "",
      highlights: [],
      byProject: {},
      byDay: {},
    };
  }

  private async writeFinalReport(
    job: ReportJob,
    memory: ReportMemory[],
    signal: AbortSignal,
  ): Promise<void> {
    const final = await this.generator.writeFinal({
      memory,
      totals: sumTotals(memory),
      from: job.params.from,
      to: job.params.to,
      project: job.params.project,
      language: job.params.language,
      style: job.params.style,
      provider: job.params.provider,
      model: job.params.model,
      signal,
    });
    if (signal.aborted || this.cancelling.has(job.id)) return;
    await this.lifecycle.update(job.userId, job.id, {
      status: "completed",
      markdown: final.markdown,
      provider: final.provider,
      model: final.model,
      finishedAt: new Date(),
    });
  }

  private async failJob(
    userId: string,
    id: string,
    error: unknown,
    errorChunk: number | null,
  ): Promise<void> {
    let errorCode: string = ERROR_CODES.INTERNAL_ERROR;
    if (error instanceof ReportGenerationError) {
      switch (error.code) {
        case "INVALID_LLM_OUTPUT":
          errorCode = ERROR_CODES.INVALID_LLM_OUTPUT;
          break;
        case "LLM_UNAVAILABLE":
          errorCode = ERROR_CODES.LLM_UNAVAILABLE;
          break;
      }
    }
    await this.lifecycle.update(userId, id, {
      status: "failed",
      errorCode,
      errorChunk,
      finishedAt: new Date(),
    });
  }

  private async loadChunkActivities(
    userId: string,
    ids: string[],
  ): Promise<Activity[]> {
    const fetched = await this.activities.findReportChunk(userId, ids);
    const byId = new Map(fetched.map((activity) => [activity.id, activity]));
    return ids
      .map((activityId) => byId.get(activityId))
      .filter((activity): activity is Activity => activity !== undefined);
  }

  private chunkIds(job: ReportJob): string[][] {
    const chunks: string[][] = [];
    for (
      let index = 0;
      index < job.activityIds.length;
      index += job.chunkSize
    ) {
      chunks.push(job.activityIds.slice(index, index + job.chunkSize));
    }
    return chunks;
  }

  private repositoryQueued() {
    return this.lifecycle.listQueued();
  }
}

function isCancellation(error: unknown): boolean {
  if (error instanceof ReportNotFoundForMemoryError) return true;
  if (!(error instanceof ReportGenerationError)) return false;
  switch (error.code) {
    case "CANCELLED":
      return true;
    default:
      return false;
  }
}

function toReportActivity(activity: Activity) {
  return {
    id: activity.id,
    date: activity.date,
    title: activity.title,
    description: activity.description,
    referenceUrls: activity.referenceUrls,
    tags: activity.tags,
    project: activity.project,
  };
}

function totals(rows: Activity[]): ReportTotals {
  const byProject: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const row of rows) {
    const project = row.project ?? "none";
    byProject[project] = (byProject[project] ?? 0) + 1;
    byDay[row.date] = (byDay[row.date] ?? 0) + 1;
  }
  return { byProject, byDay };
}

function sumTotals(memory: ReportMemory[]): ReportTotals {
  const result: ReportTotals = { byProject: {}, byDay: {} };
  for (const chunk of memory) {
    addCounts(result.byProject, chunk.byProject);
    addCounts(result.byDay, chunk.byDay);
  }
  return result;
}

function addCounts(
  target: Record<string, number>,
  additions: Record<string, number>,
): void {
  for (const [key, count] of Object.entries(additions)) {
    target[key] = (target[key] ?? 0) + count;
  }
}
