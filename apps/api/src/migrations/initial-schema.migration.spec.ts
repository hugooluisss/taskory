import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { databaseOptions } from "../app.module";
import { InitialSchema1763400000000 } from "./1763400000000-InitialSchema";

describe("Initial database migration", () => {
  const migratedPath = join(
    tmpdir(),
    `taskory-migrated-${randomUUID()}.sqlite`,
  );
  const synchronizedPath = join(
    tmpdir(),
    `taskory-synchronized-${randomUUID()}.sqlite`,
  );
  let migrated: DataSource;
  let synchronized: DataSource;

  afterEach(async () => {
    await migrated?.destroy();
    await synchronized?.destroy();
    rmSync(migratedPath, { force: true });
    rmSync(synchronizedPath, { force: true });
  });

  it("matches the synchronized entity schema and is a no-op when run twice", async () => {
    migrated = new DataSource({
      ...databaseOptions(migratedPath),
      synchronize: false,
      migrationsRun: false,
      migrations: [InitialSchema1763400000000],
    });
    synchronized = new DataSource({
      ...databaseOptions(synchronizedPath),
      synchronize: true,
      migrationsRun: false,
      migrations: [],
    });
    await Promise.all([migrated.initialize(), synchronized.initialize()]);
    expect(await migrated.runMigrations()).toHaveLength(1);
    expect(await migrated.runMigrations()).toHaveLength(0);

    const schema = async (source: DataSource) =>
      (
        await source.query(
          "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != 'migrations' ORDER BY type, name",
        )
      ).map(
        ({ type, name, sql }: { type: string; name: string; sql: string }) => ({
          type,
          name,
          sql: sql
            ?.replace(/\bIF NOT EXISTS\b/gi, "")
            .replaceAll('"', "")
            .replace(/\s+/g, " ")
            .replace(/ \(/g, "(")
            .trim()
            .toLowerCase(),
        }),
      );

    expect(await schema(migrated)).toEqual(await schema(synchronized));
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toHaveLength(0);
    expect(await migrated.query("PRAGMA foreign_keys")).toEqual([
      { foreign_keys: 1 },
    ]);
  });
});
