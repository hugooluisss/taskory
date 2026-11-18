import { DataSource } from "typeorm";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "../../test/mysql-test-database";
import { TransactionRunner } from "../common/database/transaction-runner";
import { ReportJob } from "./entities/report-job.entity";
import { ReportMemory } from "./entities/report-memory.entity";
import { ReportJobsRepository } from "./report-jobs.repository";
import { ReportMemoryRepository } from "./report-memory.repository";
import { ActiveReportExistsError } from "./errors/active-report-exists.error";
import { ReportNotFoundForMemoryError } from "./errors/report-not-found-for-memory.error";

describe("Report job repository", () => {
  let source: DataSource;
  let jobs: ReportJobsRepository;
  let memory: ReportMemoryRepository;

  beforeEach(async () => {
    source = await createMySqlTestDatabase();
    jobs = new ReportJobsRepository(
      source.getRepository(ReportJob),
      new TransactionRunner(source),
    );
    memory = new ReportMemoryRepository(source.getRepository(ReportMemory));
  });

  afterEach(async () => {
    const database = source.options.database as string;
    await source.destroy();
    await dropMySqlTestDatabase(database);
  });

  it("Finds reports only for their owner", async () => {
    const report = await createJob("owner", "completed");
    await expect(jobs.find("owner", report.id)).resolves.toMatchObject({
      id: report.id,
    });
    await expect(jobs.find("other", report.id)).resolves.toBeNull();
  });

  it("Finds queued reports in creation order", async () => {
    const first = await createJob("owner", "queued");
    const second = await createJob("owner-2", "queued");
    await expect(jobs.findQueued()).resolves.toMatchObject([
      { id: first.id },
      { id: second.id },
    ]);
  });

  it("Scopes memory by user and report and cascades on deletion", async () => {
    const report = await createJob("owner", "running");
    const foreign = await createJob("other", "running");
    await memory.save("owner", memoryRow(report.id));
    await expect(
      memory.save("owner", memoryRow(foreign.id)),
    ).rejects.toBeInstanceOf(ReportNotFoundForMemoryError);
    await memory.save("other", memoryRow(foreign.id));
    await expect(memory.list("owner", report.id)).resolves.toHaveLength(1);
    await expect(memory.list("owner", foreign.id)).resolves.toEqual([]);
    await expect(memory.list("other", foreign.id)).resolves.toEqual([
      expect.objectContaining({ reportId: foreign.id }),
    ]);
    await jobs.remove("other", foreign.id);
    await expect(memory.list("other", foreign.id)).resolves.toHaveLength(0);
  });

  it("Rejects a memory save interleaved after job deletion", async () => {
    const report = await createJob("owner", "running");
    let continueSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      continueSave = resolve;
    });
    const pendingSave = saving.then(() =>
      memory.save("owner", memoryRow(report.id)),
    );
    await jobs.remove("owner", report.id);
    continueSave();
    await expect(pendingSave).rejects.toBeInstanceOf(
      ReportNotFoundForMemoryError,
    );
    await expect(memory.list("owner", report.id)).resolves.toHaveLength(0);
    const foreignKeys = await source.query(
      "SELECT REFERENCED_TABLE_NAME AS tableName, DELETE_RULE AS onDelete FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'report_memory'",
    );
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "report_jobs",
          onDelete: "CASCADE",
        }),
      ]),
    );
  });

  it("Purges only finished reports older than the retention cutoff", async () => {
    const expired = await createJob("owner", "completed");
    const recent = await createJob("owner", "completed");
    const active = await createJob("owner", "running");
    await source.getRepository(ReportJob).update(expired.id, {
      finishedAt: new Date(Date.now() - 31 * 86400000),
    });
    await source.getRepository(ReportJob).update(recent.id, {
      finishedAt: new Date(Date.now() - 2 * 86400000),
    });
    await source
      .getRepository(ReportJob)
      .update(active.id, { finishedAt: null });
    await expect(
      jobs.purgeExpired(new Date(Date.now() - 30 * 86400000)),
    ).resolves.toEqual([
      expect.objectContaining({ id: expired.id, userId: "owner" }),
    ]);
  });

  it("Allows one concurrent active create per user and retries only a failed row", async () => {
    const creates = await Promise.allSettled([
      createJob("race-owner", "queued"),
      createJob("race-owner", "queued"),
    ]);
    expect(
      creates.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = creates.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ActiveReportExistsError);

    const failed = await createJob("retry-owner", "failed");
    await expect(jobs.retry("retry-owner", failed.id)).resolves.toBe(true);
    await expect(jobs.retry("retry-owner", failed.id)).resolves.toBe(false);
  });

  async function createJob(
    userId: string,
    status: ReportJob["status"],
  ): Promise<ReportJob> {
    await source.query(
      "INSERT IGNORE INTO users (id,email,name,passwordHash) VALUES (?,?,?,?)",
      [userId, `${userId}@example.test`, userId, "hash"],
    );
    return jobs.create({
      userId,
      status,
      params: {
        from: "2026-01-01",
        to: "2026-01-31",
        language: "en",
        style: "summary",
      },
      activityIds: ["activity"],
      chunkSize: 100,
      progressDone: 0,
      progressTotal: 1,
      markdown: null,
      provider: null,
      model: null,
      errorCode: null,
      errorChunk: null,
      finishedAt: null,
    });
  }

  function memoryRow(reportId: string): ReportMemory {
    return {
      reportId,
      userId: "owner",
      chunkIndex: 0,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-01",
      activityCount: 1,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      summary: "Done",
      highlights: [],
      byProject: { none: 1 },
      byDay: { "2026-01-01": 1 },
    };
  }
});
