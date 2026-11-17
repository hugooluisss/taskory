import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { configureHttp } from "../src/http-setup";

describe("Production database migrations", () => {
  const databasePath = join(
    tmpdir(),
    `taskory-production-${randomUUID()}.sqlite`,
  );
  let app: INestApplication;
  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    synchronize: process.env.DB_SYNCHRONIZE,
    databasePath: process.env.DATABASE_PATH,
    jwtSecret: process.env.JWT_SECRET,
    publicUrl: process.env.PUBLIC_URL,
  };

  afterAll(async () => {
    await app?.close();
    rmSync(databasePath, { force: true });
    for (const [key, value] of Object.entries({
      NODE_ENV: previousEnvironment.nodeEnv,
      DB_SYNCHRONIZE: previousEnvironment.synchronize,
      DATABASE_PATH: previousEnvironment.databasePath,
      JWT_SECRET: previousEnvironment.jwtSecret,
      PUBLIC_URL: previousEnvironment.publicUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("starts production with migrations and serves the health endpoint", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DB_SYNCHRONIZE;
    process.env.DATABASE_PATH = databasePath;
    process.env.JWT_SECRET = "test-secret";
    process.env.PUBLIC_URL = "https://taskory.example";

    const { AppModule } = await import("../src/app.module");
    app = await NestFactory.create(AppModule, { logger: false });
    configureHttp(app);
    await app.init();

    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });
});
