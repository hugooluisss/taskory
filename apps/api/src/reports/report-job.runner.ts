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
import { ReportRunsRepository } from "./report-runs.repository";
import { reportCostMicros } from "./report-cost";

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
    private readonly runs: ReportRunsRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const interrupted = await this.lifecycle.recover();
    for (const job of interrupted) {
      const usage = {
        promptTokens: job.promptTokens,
        completionTokens: job.completionTokens,
        totalTokens: job.totalTokens,
      };
      const configured = this.generator.configuration();
      await this.runs.save({
        userId: job.userId,
        jobId: job.id,
        from: job.params.from,
        to: job.params.to,
        projectIds: job.params.projectIds ?? [],
        language: job.params.language,
        style: job.params.style,
        provider: configured.provider,
        model: configured.model,
        ...usage,
        costMicros: reportCostMicros(configured.provider, usage),
        activityCount: job.activityIds.length,
        status: "failed",
      });
    }
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
    let priorUsage = emptyUsage();
    try {
      const job = await this.lifecycle.queuedForDispatch(userId, id);
      if (!job || signal.aborted || this.cancelling.has(id)) return;
      await this.lifecycle.markRunning(job);
      if (signal.aborted || this.cancelling.has(id)) return;
      const memory = await this.lifecycle.listMemory(userId, id);
      priorUsage = subtractUsage(job, sumUsage(memory));
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
      await this.writeFinalReport(job, completeMemory, priorUsage, signal);
    } catch (error) {
      if (
        !signal.aborted &&
        !this.cancelling.has(id) &&
        !isCancellation(error)
      ) {
        await this.failJob(userId, id, error, currentChunk, priorUsage);
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
      projects: job.params.projects,
      language: job.params.language,
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
      promptTokens: evaluated.promptTokens,
      completionTokens: evaluated.completionTokens,
      totalTokens: evaluated.totalTokens,
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
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      summary: "",
      highlights: [],
      byProject: {},
      byDay: {},
    };
  }

  private async writeFinalReport(
    job: ReportJob,
    memory: ReportMemory[],
    priorUsage: ReturnType<typeof emptyUsage>,
    signal: AbortSignal,
  ): Promise<void> {
    const final = await this.generator.writeFinal({
      memory,
      totals: sumTotals(memory),
      from: job.params.from,
      to: job.params.to,
      projectIds: job.params.projectIds,
      projects: job.params.projects,
      language: job.params.language,
      style: job.params.style,
      customPrompt: job.params.customPrompt,
      signal,
    });
    if (signal.aborted || this.cancelling.has(job.id)) return;
    const memoryUsage = sumUsage(memory);
    const usage = {
      promptTokens:
        memoryUsage.promptTokens + priorUsage.promptTokens + final.promptTokens,
      completionTokens:
        memoryUsage.completionTokens +
        priorUsage.completionTokens +
        final.completionTokens,
      totalTokens:
        memoryUsage.totalTokens + priorUsage.totalTokens + final.totalTokens,
    };
    const costMicros = reportCostMicros(final.provider, usage);
    await this.lifecycle.update(job.userId, job.id, {
      status: "completed",
      markdown: final.markdown,
      provider: final.provider,
      model: final.model,
      ...usage,
      costMicros,
      finishedAt: new Date(),
    });
    await this.runs.save({
      userId: job.userId,
      jobId: job.id,
      from: job.params.from,
      to: job.params.to,
      projectIds: job.params.projectIds ?? [],
      language: job.params.language,
      style: job.params.style,
      provider: final.provider,
      model: final.model,
      ...usage,
      costMicros,
      activityCount: job.activityIds.length,
      status: "completed",
    });
  }

  private async failJob(
    userId: string,
    id: string,
    error: unknown,
    errorChunk: number | null,
    priorUsage: ReturnType<typeof emptyUsage>,
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
    const job = await this.lifecycle.get(userId, id);
    const memory = await this.lifecycle.listMemory(userId, id);
    const memoryUsage = sumUsage(memory);
    const callUsage = usageOf(error);
    const usage = {
      promptTokens:
        memoryUsage.promptTokens +
        priorUsage.promptTokens +
        callUsage.promptTokens,
      completionTokens:
        memoryUsage.completionTokens +
        priorUsage.completionTokens +
        callUsage.completionTokens,
      totalTokens:
        memoryUsage.totalTokens +
        priorUsage.totalTokens +
        callUsage.totalTokens,
    };
    const configured = this.generator.configuration();
    const costMicros = reportCostMicros(configured.provider, usage);
    await this.lifecycle.update(userId, id, {
      status: "failed",
      errorCode,
      errorChunk,
      ...usage,
      costMicros,
      finishedAt: new Date(),
    });
    await this.runs.save({
      userId,
      jobId: id,
      from: job.params.from,
      to: job.params.to,
      projectIds: job.params.projectIds ?? [],
      language: job.params.language,
      style: job.params.style,
      provider: configured.provider,
      model: configured.model,
      ...usage,
      costMicros,
      activityCount: job.activityIds.length,
      status: "failed",
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

function usageOf(error: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof error !== "object" || error === null) return emptyUsage();
  const source =
    "usage" in error && typeof error.usage === "object" && error.usage !== null
      ? error.usage
      : error;
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

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function subtractUsage(
  total: ReportJob,
  memory: ReturnType<typeof emptyUsage>,
) {
  return {
    promptTokens: Math.max(0, total.promptTokens - memory.promptTokens),
    completionTokens: Math.max(
      0,
      total.completionTokens - memory.completionTokens,
    ),
    totalTokens: Math.max(0, total.totalTokens - memory.totalTokens),
  };
}

function sumUsage(memory: ReportMemory[]) {
  return memory.reduce(
    (usage, item) => ({
      promptTokens: usage.promptTokens + item.promptTokens,
      completionTokens: usage.completionTokens + item.completionTokens,
      totalTokens: usage.totalTokens + item.totalTokens,
    }),
    emptyUsage(),
  );
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
    projects: activity.projects.map(({ id, name }) => ({ id, name })),
  };
}

function totals(rows: Activity[]): ReportTotals {
  const byProject: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const row of rows) {
    const projects = row.projects.length
      ? row.projects.map(({ name }) => name)
      : ["none"];
    for (const project of projects) {
      byProject[project] = (byProject[project] ?? 0) + 1;
    }
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
