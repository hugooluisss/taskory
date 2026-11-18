import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import { User } from "../users/entities/user.entity";
import { ReportRun } from "./entities/report-run.entity";
import { ReportRunsRepository } from "./report-runs.repository";

describe("Report runs repository", () => {
  let source: DataSource;
  let runs: ReportRunsRepository;
  let databasePath: string;
  let ownerId: string;
  let otherId: string;

  beforeEach(async () => {
    databasePath = join(tmpdir(), `taskory-report-runs-${randomUUID()}.sqlite`);
    source = await new DataSource({
      type: "better-sqlite3",
      database: databasePath,
      entities: [User, ReportRun],
      synchronize: true,
      prepareDatabase: (database) => database.exec("PRAGMA foreign_keys = ON"),
    }).initialize();
    const users = source.getRepository(User);
    ownerId = (
      await users.save(
        users.create({
          email: "owner@example.com",
          name: "Owner",
          passwordHash: "hash",
        }),
      )
    ).id;
    otherId = (
      await users.save(
        users.create({
          email: "other@example.com",
          name: "Other",
          passwordHash: "hash",
        }),
      )
    ).id;
    runs = new ReportRunsRepository(
      source.getRepository(ReportRun),
      new TransactionRunner(source),
    );
  });

  afterEach(async () => {
    await source.destroy();
    await unlink(databasePath).catch(() => undefined);
  });

  it("saves usage transactionally and lists only the owner with USD cost", async () => {
    const row = await runs.save(run(ownerId, 12_345));
    await runs.save(run(otherId, 500));
    const history = await runs.list(ownerId, 1, 10);
    expect(history).toMatchObject({
      total: 1,
      page: 1,
      limit: 10,
      items: [
        {
          id: row.id,
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          costUsd: 0.012345,
          status: "completed",
        },
      ],
    });
    expect(history.items[0]).not.toHaveProperty("costMicros");
  });
});

function run(
  userId: string,
  costMicros: number,
): Omit<ReportRun, "id" | "createdAt"> {
  return {
    userId,
    jobId: null,
    from: "2026-01-01",
    to: "2026-01-02",
    projects: ["Core"],
    language: "en",
    style: "summary",
    provider: "ollama",
    model: "llama3.2",
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    costMicros,
    activityCount: 1,
    status: "completed",
  };
}
