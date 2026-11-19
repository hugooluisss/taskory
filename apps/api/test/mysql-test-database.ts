import { DataSource } from "typeorm";
import { MySqlBaseline1770000000000 } from "../src/migrations/1770000000000-MySqlBaseline";
import { ProjectCatalog1771000000000 } from "../src/migrations/1771000000000-ProjectCatalog";
import { ReportStyles1772000000000 } from "../src/migrations/1772000000000-ReportStyles";
import { ProjectDescriptions1772100000000 } from "../src/migrations/1772100000000-ProjectDescriptions";
import { ReportSharing1772200000000 } from "../src/migrations/1772200000000-ReportSharing";

export async function createMySqlTestDatabase(): Promise<DataSource> {
  for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"]) {
    if (!process.env[key])
      throw new Error(`${key} is required to run API tests against MySQL`);
  }
  const worker = process.env.JEST_WORKER_ID ?? "1";
  if (!/^\d+$/.test(worker)) throw new Error("JEST_WORKER_ID must be numeric");
  const database = `dev_taskory_test_${worker}`;
  const { User } = await import("../src/users/entities/user.entity");
  const { ApiKey } = await import("../src/api-keys/entities/api-key.entity");
  const { Activity } =
    await import("../src/activities/entities/activity.entity");
  const { Project } = await import("../src/projects/entities/project.entity");
  const { ReportJob } =
    await import("../src/reports/entities/report-job.entity");
  const { ReportMemory } =
    await import("../src/reports/entities/report-memory.entity");
  const { ReportRun } =
    await import("../src/reports/entities/report-run.entity");
  const { OAuthClient } =
    await import("../src/oauth/entities/oauth-client.entity");
  const { OAuthAuthorizationRequest } =
    await import("../src/oauth/entities/oauth-authorization-request.entity");
  const { OAuthAuthorization } =
    await import("../src/oauth/entities/oauth-authorization.entity");
  const { OAuthAuthorizationCode } =
    await import("../src/oauth/entities/oauth-authorization-code.entity");
  const { OAuthToken } =
    await import("../src/oauth/entities/oauth-token.entity");
  const connection = {
    type: "mysql" as const,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: ["DATE"],
    extra: { connectionLimit: 5 },
    entities: [
      User,
      ApiKey,
      Activity,
      Project,
      ReportJob,
      ReportMemory,
      ReportRun,
      OAuthClient,
      OAuthAuthorizationRequest,
      OAuthAuthorization,
      OAuthAuthorizationCode,
      OAuthToken,
    ],
    migrations: [
      MySqlBaseline1770000000000,
      ProjectCatalog1771000000000,
      ReportStyles1772000000000,
      ProjectDescriptions1772100000000,
      ReportSharing1772200000000,
    ],
    migrationsRun: true,
    synchronize: false,
  };
  const { createConnection } = await import("mysql2/promise");
  const admin = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await admin.end();
  }
  process.env.DB_NAME = database;
  try {
    return await new DataSource(connection).initialize();
  } catch (error) {
    await dropMySqlTestDatabase(database);
    throw error;
  }
}

export async function dropMySqlTestDatabase(database: string): Promise<void> {
  if (!/^dev_taskory_test_[0-9]+$/.test(database))
    throw new Error(
      "Refusing to drop a database outside this Jest worker's test database",
    );
  const { createConnection } = await import("mysql2/promise");
  const connection = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  try {
    await connection.query(`DROP DATABASE \`${database}\``);
  } finally {
    await connection.end();
  }
}
