import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";

const tables = [
  "users",
  "api_keys",
  "activities",
  "report_jobs",
  "oauth_clients",
  "oauth_authorization_requests",
  "oauth_authorizations",
  "oauth_authorization_codes",
  "oauth_tokens",
  "report_memory",
  "report_runs",
];

test("migrates tiny SQLite data and refuses a second migration", async () => {
  assert.equal(
    process.env.DB_NAME,
    "dev_taskory_test_mig",
    "test is limited to the named scratch DB",
  );
  const target = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  const directory = mkdtempSync(join(tmpdir(), "taskory-migration-test-"));
  const sourcePath = join(directory, "tiny.sqlite");
  const source = new Database(sourcePath);
  let sourceOpen = true;
  try {
    for (const table of tables) {
      const [columns] = await target.query(`SHOW COLUMNS FROM \`${table}\``);
      const writable = columns.filter(
        (column) => !/\b(?:VIRTUAL|STORED)\s+GENERATED\b/i.test(column.Extra),
      );
      source.exec(
        `CREATE TABLE \`${table}\` (${writable.map(({ Field }) => `\`${Field}\``).join(",")})`,
      );
      if (table === "users") {
        const values = writable.map(({ Field, Type }) => {
          if (Field === "id") return "tiny-user";
          if (Field === "email") return "tiny@example.test";
          if (Field === "name") return "Tiny";
          if (Field === "passwordHash") return "hash";
          if (Field.toLowerCase().includes("at"))
            return "2026-01-02 03:04:05.000";
          if (/json/i.test(Type)) return "[]";
          if (/date/i.test(Type)) return "2026-01-02";
          if (/int|decimal|float|double/i.test(Type)) return 0;
          return "en";
        });
        const names = writable.map(({ Field }) => `\`${Field}\``).join(",");
        source
          .prepare(
            `INSERT INTO users (${names}) VALUES (${values.map(() => "?").join(",")})`,
          )
          .run(...values);
      }
    }
    source.close();
    sourceOpen = false;

    const script = fileURLToPath(
      new URL("./migrate-sqlite-to-mysql.mjs", import.meta.url),
    );
    const run = () =>
      execFileSync(process.execPath, [script, sourcePath], {
        env: process.env,
        encoding: "utf8",
      });
    const output = run();
    assert.match(output, /users: source=1, target=1/);
    for (const table of tables.filter((name) => name !== "users")) {
      assert.match(output, new RegExp(`${table}: source=0, target=0`));
    }
    assert.throws(run, /Refusing to migrate: target table users is not empty/);
  } finally {
    if (sourceOpen) source.close();
    await target.end();
    rmSync(directory, { recursive: true, force: true });
  }
});
