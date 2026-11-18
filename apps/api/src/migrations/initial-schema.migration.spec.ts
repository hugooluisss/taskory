import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "../../test/mysql-test-database";

describe("Schema is migration managed", () => {
  let source: DataSource;
  let database: string;
  afterEach(async () => {
    database = source?.options.database as string;
    await source?.destroy();
    if (database) await dropMySqlTestDatabase(database);
  });

  it("Schema is created by migration and can be rolled back", async () => {
    source = await createMySqlTestDatabase();
    expect(await source.showMigrations()).toBe(false);
    expect((await source.query("SHOW TABLES")).length).toBeGreaterThan(10);
    for (const entity of source.entityMetadatas) {
      const columns = (await source.query(
        `SHOW COLUMNS FROM \`${entity.tableName}\``,
      )) as { Field: string }[];
      expect(columns.map(({ Field }) => Field)).toEqual(
        expect.arrayContaining(
          entity.columns.map(({ databaseName }) => databaseName),
        ),
      );
    }
    for (let count = source.migrations.length; count > 0; count -= 1) {
      await source.undoLastMigration();
    }
    expect(await source.query("SHOW TABLES")).toEqual([
      { [`Tables_in_${source.options.database}`]: "migrations" },
    ]);
  });

  it("Active report job uniqueness is enforced", async () => {
    source = await createMySqlTestDatabase();
    const userId = "00000000-0000-4000-8000-000000000001";
    await source.query(
      "INSERT INTO users (id,email,name,passwordHash) VALUES (?,?,?,?)",
      [userId, "unique@example.test", "Test", "hash"],
    );
    const values = [
      "00000000-0000-4000-8000-000000000002",
      userId,
      "queued",
      JSON.stringify({}),
      JSON.stringify([]),
      1,
      0,
      1,
    ];
    await source.query(
      "INSERT INTO report_jobs (id,userId,status,params,activityIds,chunkSize,progressDone,progressTotal) VALUES (?,?,?,?,?,?,?,?)",
      values,
    );
    const insert = (id: string, status: string) =>
      source.query(
        "INSERT INTO report_jobs (id,userId,status,params,activityIds,chunkSize,progressDone,progressTotal) VALUES (?,?,?,?,?,?,?,?)",
        [id, userId, status, JSON.stringify({}), JSON.stringify([]), 1, 0, 1],
      );
    await expect(
      insert("00000000-0000-4000-8000-000000000003", "running"),
    ).rejects.toThrow();
    await insert("00000000-0000-4000-8000-000000000004", "completed");
    await insert("00000000-0000-4000-8000-000000000005", "failed");
  });

  it("Merges case variants using the most frequent spelling and maps SIGEI special value", async () => {
    source = await createMySqlTestDatabase();
    await source.undoLastMigration();
    await source.undoLastMigration();
    await source.undoLastMigration();
    const userId = "00000000-0000-4000-8000-000000000011";
    await source.query("INSERT INTO users (id,email,name,passwordHash) VALUES (?,?,?,?)", [userId, "projects@example.test", "Test", "hash"]);
    for (const [id, name] of [
      ["00000000-0000-4000-8000-000000000012", "SIGEI"],
      ["00000000-0000-4000-8000-000000000013", "sigei"],
      ["00000000-0000-4000-8000-000000000014", "SIGEI"],
      ["00000000-0000-4000-8000-000000000015", "Mantenimientos de seguridad, SIGEI"],
    ]) {
      await source.query("INSERT INTO activities (id,userId,date,title,referenceUrls,tags,project) VALUES (?,?,?, ?, JSON_ARRAY(), JSON_ARRAY(), ?)", [id, userId, "2026-11-01", name, name]);
    }
    await source.runMigrations();
    const projects = await source.query("SELECT name FROM projects WHERE userId=?", [userId]);
    expect(projects).toEqual([{ name: "SIGEI" }]);
    const assigned = await source.query("SELECT ap.projectId FROM activity_projects ap JOIN activities a ON a.id=ap.activityId WHERE a.userId=?", [userId]);
    expect(assigned).toHaveLength(4);
    expect(new Set(assigned.map(({ projectId }: { projectId: string }) => projectId)).size).toBe(1);
  });
});
