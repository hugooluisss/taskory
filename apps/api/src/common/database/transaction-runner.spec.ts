import { DataSource } from "typeorm";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "../../../test/mysql-test-database";
import { TransactionRunner } from "./transaction-runner";

describe("Transaction isolation", () => {
  let source: DataSource;
  let runner: TransactionRunner;

  beforeEach(async () => {
    source = await createMySqlTestDatabase();
    await source.query("CREATE TABLE transaction_rows (value TEXT NOT NULL)");
    runner = new TransactionRunner(source);
  });

  afterEach(async () => {
    const database = source.options.database as string;
    await source.destroy();
    await dropMySqlTestDatabase(database);
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
      await manager.query("INSERT INTO transaction_rows(value) VALUES ('A')");
      signalFirstWrite();
      await firstWriteDone;
      throw new Error("rollback A");
    });
    await firstWrite;
    const committed = runner.run(async (manager) => {
      await manager.query("INSERT INTO transaction_rows(value) VALUES ('B')");
      return "committed";
    });
    releaseFailure();

    await expect(failed).rejects.toThrow("rollback A");
    await expect(committed).resolves.toBe("committed");
    await expect(
      source.query("SELECT value FROM transaction_rows"),
    ).resolves.toEqual([{ value: "B" }]);
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
          await manager.query(
            "INSERT INTO transaction_rows(value) VALUES (?)",
            [`${index}`],
          );
        }),
      ),
    );

    const rows = await source.query(
      "SELECT value FROM transaction_rows ORDER BY value",
    );
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((row: { value: string }) => row.value)).size).toBe(
      100,
    );
  });
});
