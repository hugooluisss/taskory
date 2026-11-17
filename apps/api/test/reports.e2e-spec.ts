import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { DataSource } from "typeorm";
import { LlmUnavailableError } from "@taskory/llm";
import { AppModule } from "../src/app.module";
import { Activity } from "../src/activities/entities/activity.entity";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";
import { configureHttp } from "../src/http-setup";

describe("Report generation", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;
  let other: string;
  let ownerId: string;
  let generator: FakeGenerator;

  beforeEach(async () => {
    process.env.JWT_SECRET = "e2e-secret";
    databasePath = join(tmpdir(), `taskory-reports-${randomUUID()}.sqlite`);
    process.env.DATABASE_PATH = databasePath;
    generator = new FakeGenerator();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(REPORT_GENERATOR)
      .useValue(generator)
      .compile();
    app = module.createNestApplication();
    currentApp = app;
    configureHttp(app);
    await app.init();
    owner = await register("owner");
    ownerId = (
      await request(app.getHttpServer()).get("/api/v1/auth/me").set(auth(owner))
    ).body.id as string;
    other = await register("other");
  });

  afterEach(async () => {
    await app.close();
    await unlink(databasePath).catch(() => undefined);
    await unlink(`${databasePath}-shm`).catch(() => undefined);
    await unlink(`${databasePath}-wal`).catch(() => undefined);
  });

  it("Successful report", async () => {
    await create(owner, { date: "2026-11-16", title: "Owned" });
    const response = await report(owner).expect(200);
    expect(response.body).toEqual({
      markdown: "# Report",
      provider: "ollama",
      model: "test",
      activityCount: 1,
    });
  });

  it("Only own activities", async () => {
    await create(owner, { date: "2026-11-16", title: "Mine" });
    await create(other, { date: "2026-11-16", title: "Secret" });
    await report(owner).expect(200);
    expect(
      generator.generate.mock.calls[0][0].activities.map(
        (item: { title: string }) => item.title,
      ),
    ).toEqual(["Mine"]);
  });

  it("No activities", async () => {
    await report(owner)
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe("NO_ACTIVITIES"));
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Range too large", async () => {
    const rows = Array.from({ length: 301 }, (_, index) => ({
      userId: ownerId,
      date: "2026-11-16",
      title: `Activity ${index}`,
      description: null,
      referenceUrls: [],
      tags: [],
      project: null,
    }));
    await app.get(DataSource).getRepository(Activity).insert(rows);
    await report(owner)
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe("RANGE_TOO_LARGE"));
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Tag filter", async () => {
    await create(owner, {
      date: "2026-11-16",
      title: "Match wanted",
      tags: ["wanted"],
    });
    await create(owner, {
      date: "2026-11-16",
      title: "Match second",
      tags: ["second"],
    });
    await create(owner, { date: "2026-11-16", title: "Skip", tags: ["other"] });
    await report(owner, { tags: [" WANTED ", " SECOND ", "wanted"] }).expect(
      200,
    );
    expect(
      generator.generate.mock.calls[0][0].activities.map(
        (item: { title: string }) => item.title,
      ),
    ).toEqual(["Match wanted", "Match second"]);
  });

  it("Mixed case and whitespace tag filter", async () => {
    await create(owner, {
      date: "2026-11-16",
      title: "API activity",
      tags: ["API"],
    });
    await report(owner, { tags: [" API "] }).expect(200);
    expect(generator.generate.mock.calls[0][0].activities).toHaveLength(1);
  });

  it("Model over 100 characters", async () => {
    await report(owner, { model: "x".repeat(101) })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
  });

  it("Inverted range", async () => {
    await report(owner, { from: "2026-12-01", to: "2026-11-30" })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Unknown provider", async () => {
    await report(owner, { provider: "unknown" })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("UNKNOWN_PROVIDER"));
  });

  it("Provider down", async () => {
    await create(owner, { date: "2026-11-16", title: "Owned" });
    generator.generate.mockRejectedValueOnce(new LlmUnavailableError("down"));
    await report(owner)
      .expect(502)
      .expect(({ body }) => expect(body.code).toBe("LLM_UNAVAILABLE"));
  });

  it("Unreachable provider", async () => {
    generator.listProviders.mockResolvedValue([
      { id: "ollama", defaultModel: "test", available: false },
    ]);
    await request(app.getHttpServer())
      .get("/api/v1/reports/providers")
      .set(auth(owner))
      .expect(200, [{ id: "ollama", defaultModel: "test", available: false }]);
  });

  it("Missing token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/reports/providers")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/reports")
      .send({})
      .expect(401);
  });

  it("Spanish client", async () => {
    const response = await report(owner)
      .set("Accept-Language", "es")
      .expect(422);
    expect(response.body).toMatchObject({
      code: "NO_ACTIVITIES",
      message: expect.stringMatching(/actividades/i),
    });
  });
});

class FakeGenerator {
  generate = jest
    .fn()
    .mockResolvedValue({
      markdown: "# Report",
      provider: "ollama",
      model: "test",
    });
  listProviders = jest
    .fn()
    .mockResolvedValue([
      { id: "ollama", defaultModel: "test", available: true },
    ]);
  hasProvider = jest.fn((id = "ollama") => id === "ollama");
}

describe("LLM timeout integration", () => {
  let app: INestApplication;
  let databasePath: string;
  let token: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.JWT_SECRET = "e2e-secret";
    process.env.DEFAULT_LLM_PROVIDER = "ollama";
    process.env.DEFAULT_LLM_MODEL = "llama3.2";
    process.env.OLLAMA_BASE_URL = "http://ollama.test";
    process.env.DEEPSEEK_API_KEY = "";
    process.env.LLM_TIMEOUT_MS = "25";
    global.fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("Expected an abort signal"));
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    databasePath = join(
      tmpdir(),
      `taskory-reports-timeout-${randomUUID()}.sqlite`,
    );
    process.env.DATABASE_PATH = databasePath;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    currentApp = app;
    configureHttp(app);
    await app.init();
    token = await register("timeout");
    await create(token, { date: "2026-11-16", title: "Timeout activity" });
  });

  afterEach(async () => {
    await app.close();
    global.fetch = originalFetch;
    await unlink(databasePath).catch(() => undefined);
    await unlink(`${databasePath}-shm`).catch(() => undefined);
    await unlink(`${databasePath}-wal`).catch(() => undefined);
  });

  it("Real ReportGenerator timeout returns LLM_UNAVAILABLE", async () => {
    const response = await report(token).expect(502);
    expect(response.body.code).toBe("LLM_UNAVAILABLE");
  });
});

async function register(name: string): Promise<string> {
  const response = await request(appServer())
    .post("/api/v1/auth/register")
    .send({
      email: `${name}-${randomUUID()}@example.com`,
      name,
      password: "password-123",
    });
  return response.body.token as string;
}

function appServer() {
  return currentApp.getHttpServer();
}

let currentApp: INestApplication;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function create(token: string, body: object) {
  return request(currentApp.getHttpServer())
    .post("/api/v1/activities")
    .set(auth(token))
    .send(body);
}

function report(token: string, overrides: Record<string, unknown> = {}) {
  return request(currentApp.getHttpServer())
    .post("/api/v1/reports")
    .set(auth(token))
    .send({
      from: "2026-11-01",
      to: "2026-11-30",
      language: "en",
      ...overrides,
    });
}
