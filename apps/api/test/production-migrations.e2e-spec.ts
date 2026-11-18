import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureHttp } from "../src/http-setup";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "./mysql-test-database";

describe("Production database migrations", () => {
  let app: INestApplication;
  let database: string;
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    dbName: process.env.DB_NAME,
    jwtSecret: process.env.JWT_SECRET,
    publicUrl: process.env.PUBLIC_URL,
  };

  afterAll(async () => {
    await app?.close();
    if (database) await dropMySqlTestDatabase(database);
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      DB_NAME: previous.dbName,
      JWT_SECRET: previous.jwtSecret,
      PUBLIC_URL: previous.publicUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("starts production with migrations and serves the health endpoint", async () => {
    const source = await createMySqlTestDatabase();
    database = source.options.database as string;
    await source.destroy();
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret";
    process.env.PUBLIC_URL = "https://taskory.example";
    const { AppModule: module } = await import("../src/app.module");
    app = await NestFactory.create(module, { logger: false });
    configureHttp(app);
    await app.init();
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });
});
