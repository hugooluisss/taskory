import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { TransactionRunner } from "./transaction-runner";

describe("Transaction isolation", () => {
  let source: DataSource;
  let runner: TransactionRunner;
  let databasePath: string;

  beforeEach(async () => {
    databasePath = join(
      tmpdir(),
      `taskory-transactions-${randomUUID()}.sqlite`,
    );
    source = await new DataSource({
      type: "better-sqlite3",
      database: databasePath,
      entities: [],
    }).initialize();
    await source.query("CREATE TABLE rows (value TEXT NOT NULL)");
    runner = new TransactionRunner(source);
  });

  afterEach(async () => {
    await source.destroy();
    await unlink(databasePath).catch(() => undefined);
  });

  it("Rolls back a failed overlapping transaction and commits the queued transaction rows", async () => {
    let releaseFailure!: () => void;
    const firstWriteDone = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    let signalFirstWrite!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      signalFirstWrite = resolve;
    });

    const failed = runner.run(async (manager) => {
      await manager.query("INSERT INTO rows(value) VALUES ('A')");
      signalFirstWrite();
      await firstWriteDone;
      throw new Error("rollback A");
    });
    await firstWrite;
    const committed = runner.run(async (manager) => {
      await manager.query("INSERT INTO rows(value) VALUES ('B')");
      return "committed";
    });
    releaseFailure();

    await expect(failed).rejects.toThrow("rollback A");
    await expect(committed).resolves.toBe("committed");
    await expect(source.query("SELECT value FROM rows")).resolves.toEqual([
      { value: "B" },
    ]);
  });

  it("Keeps the queue usable after errors and drains 100 queued transactions", async () => {
    await expect(
      runner.run(async () => {
        throw new Error("expected failure");
      }),
    ).rejects.toThrow("expected failure");

    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        runner.run(async (manager) => {
          await manager.query("INSERT INTO rows(value) VALUES (?)", [
            `${index}`,
          ]);
        }),
      ),
    );

    const rows = await source.query("SELECT value FROM rows ORDER BY rowid");
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((row: { value: string }) => row.value)).size).toBe(
      100,
    );
  });
});
