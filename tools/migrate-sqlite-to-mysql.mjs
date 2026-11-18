import { existsSync } from "node:fs";
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
const jsonColumns = {
  activities: ["referenceUrls", "tags"],
  report_jobs: ["params", "activityIds"],
  oauth_clients: ["redirectUris"],
  report_memory: ["highlights", "byProject", "byDay"],
  report_runs: ["projects"],
};
const dateColumns = new Set(["date", "dateFrom", "dateTo", "from", "to"]);
const timestampColumns = new Set([
  "createdAt",
  "updatedAt",
  "lastUsedAt",
  "revokedAt",
  "finishedAt",
  "expiresAt",
  "decidedAt",
  "usedAt",
  "rotatedAt",
]);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function isGenerated(column) {
  return /\b(?:VIRTUAL|STORED)\s+GENERATED\b/i.test(column.Extra ?? "");
}

function toDate(value, column) {
  if (value === null) return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Invalid calendar date in ${column}`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`Invalid calendar date in ${column}`);
  }
  return text;
}

function toTimestamp(value, column) {
  if (value === null) return null;
  const text = String(value).trim();
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.valueOf()))
    throw new Error(`Invalid timestamp in ${column}`);
  return date.toISOString().slice(0, 23).replace("T", " ");
}

function convertValue(table, column, value, type) {
  if (value === null) return null;
  if (jsonColumns[table]?.includes(column)) {
    return JSON.stringify(JSON.parse(String(value)));
  }
  if (dateColumns.has(column)) return toDate(value, `${table}.${column}`);
  if (timestampColumns.has(column))
    return toTimestamp(value, `${table}.${column}`);
  if (/^(tinyint\(1\)|boolean|bool)$/i.test(type)) {
    if (value !== 0 && value !== 1)
      throw new Error(`Invalid boolean in ${table}.${column}`);
    return value === 1 ? 1 : 0;
  }
  return value;
}

async function migrate() {
  const sourcePath = process.argv[2];
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error(
      "Usage: node tools/migrate-sqlite-to-mysql.mjs <read-only-sqlite-copy>",
    );
  }

  let source;
  let target;
  let transaction = false;
  try {
    source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    target = await mysql.createConnection({
      host: required("DB_HOST"),
      port: Number(required("DB_PORT")),
      database: required("DB_NAME"),
      user: required("DB_USER"),
      password: required("DB_PASSWORD"),
      charset: "utf8mb4",
      timezone: "Z",
      dateStrings: true,
    });
    const sourceTables = new Set(
      source
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map(({ name }) => name),
    );
    for (const table of tables) {
      if (!sourceTables.has(table))
        throw new Error(`SQLite source is missing table ${table}`);
    }

    const sourceRows = new Map();
    const sourceColumns = new Map();
    for (const table of tables) {
      sourceColumns.set(
        table,
        source
          .prepare(`PRAGMA table_info(\`${table}\`)`)
          .all()
          .map(({ name }) => name),
      );
      sourceRows.set(table, source.prepare(`SELECT * FROM \`${table}\``).all());
    }

    const targetColumns = new Map();
    for (const table of tables) {
      const [rows] = await target.query(`SHOW COLUMNS FROM \`${table}\``);
      const columns = new Map(
        rows.map((row) => [row.Field.toLowerCase(), row]),
      );
      const sourceColumnNames = sourceColumns.get(table);
      if (!sourceColumnNames.length) {
        throw new Error(`SQLite source table ${table} has no columns`);
      }
      for (const name of sourceColumnNames) {
        if (
          !columns.has(name.toLowerCase()) ||
          isGenerated(columns.get(name.toLowerCase()))
        ) {
          throw new Error(
            `MySQL table ${table} has no writable source column ${name}`,
          );
        }
      }
      const absentRequired = rows.filter(
        (column) =>
          !sourceColumnNames.some(
            (name) => name.toLowerCase() === column.Field.toLowerCase(),
          ) &&
          !isGenerated(column) &&
          !/auto_increment/i.test(column.Extra ?? "") &&
          column.Default === null &&
          column.Null !== "YES",
      );
      if (absentRequired.length) {
        throw new Error(
          `SQLite source is missing required target column ${table}.${absentRequired[0].Field}`,
        );
      }
      targetColumns.set(table, columns);
    }

    for (const table of tables) {
      const [[{ count }]] = await target.query(
        `SELECT COUNT(*) AS count FROM \`${table}\``,
      );
      if (Number(count) !== 0)
        throw new Error(
          `Refusing to migrate: target table ${table} is not empty`,
        );
    }

    await target.beginTransaction();
    transaction = true;
    for (const table of tables) {
      const rows = sourceRows.get(table);
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const types = targetColumns.get(table);
      const values = rows.map((row) =>
        columns.map((column) =>
          convertValue(
            table,
            column,
            row[column],
            types.get(column.toLowerCase()).Type,
          ),
        ),
      );
      const placeholders = `(${columns.map(() => "?").join(",")})`;
      for (let start = 0; start < values.length; start += 100) {
        const batch = values.slice(start, start + 100);
        const quotedColumns = columns.map((name) => `\`${name}\``).join(",");
        const sql = `INSERT INTO \`${table}\` (${quotedColumns}) VALUES ${batch.map(() => placeholders).join(",")}`;
        await target.query(sql, batch.flat());
      }
    }

    const counts = [];
    for (const table of tables) {
      const sourceCount = sourceRows.get(table).length;
      const [[{ count: targetCount }]] = await target.query(
        `SELECT COUNT(*) AS count FROM \`${table}\``,
      );
      if (sourceCount !== Number(targetCount)) {
        throw new Error(
          `Row count mismatch for ${table}: source=${sourceCount}, target=${targetCount}`,
        );
      }
      counts.push([table, sourceCount, Number(targetCount)]);
    }
    await target.commit();
    transaction = false;
    for (const [table, sourceCount, targetCount] of counts) {
      console.log(`${table}: source=${sourceCount}, target=${targetCount}`);
    }
  } catch (error) {
    if (transaction) await target.rollback();
    throw error;
  } finally {
    source?.close();
    if (target) await target.end();
  }
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
