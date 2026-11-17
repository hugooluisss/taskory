import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { DataSource } from "typeorm";
import { ReportJob } from "../src/reports/entities/report-job.entity";
import { ReportMemory } from "../src/reports/entities/report-memory.entity";
import { ReportGenerationError } from "../src/reports/ports/report-generation-error";
import { ReportJobRunner } from "../src/reports/report-job.runner";
import { ReportMemoryRepository } from "../src/reports/report-memory.repository";
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
  let otherId: string;
  let generator: FakeGenerator;

  beforeEach(async () => {
    process.env.JWT_SECRET = "e2e-secret";
    databasePath = join(tmpdir(), `taskory-reports-${randomUUID()}.sqlite`);
    process.env.DATABASE_PATH = databasePath;
    generator = new FakeGenerator();
    app = await bootApp(generator);
    owner = await register("owner");
    ownerId = (
      await request(app.getHttpServer()).get("/api/v1/auth/me").set(auth(owner))
    ).body.id as string;
    other = await register("other");
    otherId = (
      await request(app.getHttpServer()).get("/api/v1/auth/me").set(auth(other))
    ).body.id as string;
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

  describe("Report project selection", () => {
    beforeEach(async () => {
      await create(owner, {
        date: "2026-11-16",
        title: "Alpha",
        project: "Alpha",
      });
      await create(owner, {
        date: "2026-11-17",
        title: "Beta",
        project: "Beta",
      });
      await create(owner, { date: "2026-11-18", title: "Unassigned" });
    });

    it("One project", async () => {
      await report(owner, { projects: ["Alpha"] })
        .expect(200)
        .expect(({ body }) => expect(body.activityCount).toBe(1));
    });

    it("Several projects", async () => {
      await report(owner, { projects: [" Alpha ", "Beta", "Alpha"] })
        .expect(200)
        .expect(({ body }) => expect(body.activityCount).toBe(2));
      expect(generator.generate.mock.calls[0][0].projects).toEqual([
        "Alpha",
        "Beta",
      ]);
    });

    it("None means all", async () => {
      await report(owner, { projects: [] })
        .expect(200)
        .expect(({ body }) => {
          expect(body.activityCount).toBe(3);
        });
    });

    it("Too many or invalid projects", async () => {
      for (const projects of [
        [" "],
        ["x".repeat(101)],
        [null],
        Array(21).fill("A"),
      ]) {
        await report(owner, { projects })
          .expect(400)
          .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
      }
      expect(generator.generate).not.toHaveBeenCalled();
    });
  });

  describe("Final report from memory", () => {
    it("Completion", async () => {
      await insertActivities(250, ownerId, app);
      const created = await report(owner).expect(202);
      expect(created.body).toMatchObject({
        status: "queued",
        progress: { done: 0, total: 3 },
      });
      await app.get(ReportJobRunner).awaitIdle();
      const status = await request(app.getHttpServer())
        .get(`/api/v1/reports/${created.body.id}`)
        .set(auth(owner));
      expect(status.body).toMatchObject({
        status: "completed",
        progress: { done: 3, total: 3 },
        markdown: "# Final report",
      });
      expect(generator.evaluateChunk).toHaveBeenCalledTimes(3);
      expect(generator.writeFinal).toHaveBeenCalledTimes(1);
    });
  });

  it("Foreign job is not found", async () => {
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await request(app.getHttpServer())
      .get(`/api/v1/reports/${created.body.id}`)
      .set(auth(other))
      .expect(404);
  });

  it("Failure can be retried until completion", async () => {
    generator.evaluateChunk.mockRejectedValueOnce(
      new ReportGenerationError("INVALID_LLM_OUTPUT"),
    );
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await app.get(ReportJobRunner).awaitIdle();
    const failed = await reportStatus(owner, created.body.id);
    expect(failed.body.error).toMatchObject({
      code: "INVALID_LLM_OUTPUT",
      chunk: 0,
    });
    const retry = await request(app.getHttpServer())
      .post(`/api/v1/reports/${created.body.id}/retry`)
      .set(auth(owner))
      .expect(202);
    expect(retry.body).toMatchObject({ status: "queued" });
    await app.get(ReportJobRunner).awaitIdle();
    const completed = await reportStatus(owner, created.body.id);
    expect(completed.body.markdown).toBe("# Final report");
  });

  it("Completed report cannot be retried", async () => {
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await app.get(ReportJobRunner).awaitIdle();
    await reportStatus(owner, created.body.id);
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${created.body.id}/retry`)
      .set(auth(owner))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("REPORT_NOT_RETRYABLE"));
  });

  it("Foreign user cannot get, retry or delete a report", async () => {
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await request(app.getHttpServer())
      .get(`/api/v1/reports/${created.body.id}`)
      .set(auth(other))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${created.body.id}/retry`)
      .set(auth(other))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/reports/${created.body.id}`)
      .set(auth(other))
      .expect(404);
  });

  it("Report ids must be UUIDs", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/reports/not-a-uuid")
      .set(auth(owner))
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/reports/not-a-uuid/retry")
      .set(auth(owner))
      .expect(400);
    await request(app.getHttpServer())
      .delete("/api/v1/reports/not-a-uuid")
      .set(auth(owner))
      .expect(400);
  });

  it("Report endpoints require authentication", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/reports")
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/reports/${randomUUID()}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${randomUUID()}/retry`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/v1/reports/${randomUUID()}`)
      .expect(401);
  });

  describe("Single pass for small reports", () => {
    it("Up to 100 activities", async () => {
      await insertActivities(100, ownerId, app);
      const response = await report(owner).expect(200);
      expect(response.body.activityCount).toBe(100);
      expect(generator.generate).toHaveBeenCalledTimes(1);
      expect(generator.evaluateChunk).not.toHaveBeenCalled();
    });
  });

  describe("Report job status", () => {
    it("Running job", async () => {
      const started = deferred<void>();
      const evaluation = deferred<{
        summary: string;
        highlights: [];
        provider: string;
        model: string;
      }>();
      generator.evaluateChunk.mockImplementation(() => {
        started.resolve();
        return evaluation.promise;
      });
      await insertActivities(101, ownerId, app);
      const created = await report(owner).expect(202);
      await started.promise;

      const status = await request(app.getHttpServer())
        .get(`/api/v1/reports/${created.body.id}`)
        .set(auth(owner))
        .expect(200);
      expect(status.body).toMatchObject({
        id: created.body.id,
        status: "running",
        progress: { total: 2 },
        finishedAt: null,
      });
      expect(status.body.createdAt).toEqual(expect.any(String));
      expect(status.body.progress.done).toBeGreaterThanOrEqual(0);
      expect(status.body.progress.done).toBeLessThanOrEqual(
        status.body.progress.total,
      );

      evaluation.resolve({
        summary: "Summary",
        highlights: [],
        provider: "fake",
        model: "fake",
      });
      await app.get(ReportJobRunner).awaitIdle();
    });

    it("Failed job", async () => {
      generator.evaluateChunk.mockRejectedValueOnce(
        new ReportGenerationError("INVALID_LLM_OUTPUT"),
      );
      await insertActivities(101, ownerId, app);
      const created = await report(owner).expect(202);
      await app.get(ReportJobRunner).awaitIdle();

      const english = await reportStatus(owner, created.body.id);
      const spanish = await request(app.getHttpServer())
        .get(`/api/v1/reports/${created.body.id}`)
        .set(auth(owner))
        .set("Accept-Language", "es");
      expect(english.body.error).toMatchObject({
        code: "INVALID_LLM_OUTPUT",
        message: "The LLM returned invalid output",
      });
      expect(spanish.body.error).toMatchObject({
        code: "INVALID_LLM_OUTPUT",
        message: "El proveedor de IA devolvió una respuesta no válida",
      });
    });
  });

  it("Range too large uses the configured activity limit", async () => {
    const previousLimit = process.env.REPORT_MAX_ACTIVITIES;
    process.env.REPORT_MAX_ACTIVITIES = "2";
    await insertActivities(3, ownerId, app);
    await report(owner)
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe("RANGE_TOO_LARGE"));
    if (previousLimit === undefined) delete process.env.REPORT_MAX_ACTIVITIES;
    else process.env.REPORT_MAX_ACTIVITIES = previousLimit;
    expect(generator.generate).not.toHaveBeenCalled();
    expect(generator.evaluateChunk).not.toHaveBeenCalled();
  });

  it("Retry errors are localized in Spanish", async () => {
    generator.evaluateChunk.mockImplementation(
      () => new Promise(() => undefined),
    );
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${created.body.id}/retry`)
      .set(auth(owner))
      .set("Accept-Language", "es")
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe("REPORT_NOT_RETRYABLE");
        expect(body.message).toMatch(/reintentar/i);
      });
  });

  it("Delete report", async () => {
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await request(app.getHttpServer())
      .delete(`/api/v1/reports/${created.body.id}`)
      .set(auth(owner))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/reports/${created.body.id}`)
      .set(auth(owner))
      .expect(404);
  });

  describe("Report memory", () => {
    it("Memory survives a restart", async () => {
      await insertActivities(101, otherId, app);
      const jobs = app.get(DataSource).getRepository(ReportJob);
      const activityIds = await reportActivityIds(otherId);
      const interrupted = await jobs.save(
        seedJob(ownerId, "running", activityIds),
      );
      const queued = await jobs.save(seedJob(otherId, "queued", activityIds));
      const firstChunk = memoryRow(interrupted.id, ownerId, 0);
      const queuedChunk = memoryRow(queued.id, otherId, 0);
      await app.get(ReportMemoryRepository).save(ownerId, firstChunk);
      await app.get(ReportMemoryRepository).save(otherId, queuedChunk);
      await jobs.update(interrupted.id, { progressDone: 1 });
      await jobs.update(queued.id, { progressDone: 1 });

      await app.close();
      generator = new FakeGenerator();
      app = await bootApp(generator);
      await app.get(ReportJobRunner).awaitIdle();

      const interruptedStatus = await reportStatus(owner, interrupted.id);
      const queuedStatus = await reportStatus(other, queued.id);
      expect(interruptedStatus.body).toMatchObject({
        status: "failed",
        error: { code: "INTERRUPTED" },
        progress: { done: 1, total: 2 },
      });
      expect(queuedStatus.body).toMatchObject({
        status: "completed",
        progress: { done: 2, total: 2 },
      });
      expect(generator.evaluateChunk).toHaveBeenCalledTimes(1);
      await expect(
        app.get(ReportMemoryRepository).list(ownerId, interrupted.id),
      ).resolves.toHaveLength(1);
      await expect(
        app.get(ReportMemoryRepository).list(otherId, queued.id),
      ).resolves.toHaveLength(2);
    });
  });

  describe("Concurrency limits", () => {
    it("Second job of the same user", async () => {
      const started = deferred<void>();
      const evaluation = deferred<{
        summary: string;
        highlights: [];
        provider: string;
        model: string;
      }>();
      generator.evaluateChunk.mockImplementation(() => {
        started.resolve();
        return evaluation.promise;
      });
      await insertActivities(101, ownerId, app);

      const [first, second] = await Promise.all([report(owner), report(owner)]);
      const responses = [first, second];
      expect(responses.map(({ status }) => status).sort()).toEqual([202, 409]);
      expect(
        responses.find(({ status }) => status === 409)?.body,
      ).toMatchObject({ code: "REPORT_IN_PROGRESS", id: expect.any(String) });
      await started.promise;
      const active = await app
        .get(DataSource)
        .getRepository(ReportJob)
        .countBy({ userId: ownerId, status: "queued" });
      const running = await app
        .get(DataSource)
        .getRepository(ReportJob)
        .countBy({ userId: ownerId, status: "running" });
      expect(active + running).toBe(1);
      evaluation.resolve({
        summary: "chunk",
        highlights: [],
        provider: "fake",
        model: "fake",
      });
      await app.get(ReportJobRunner).awaitIdle();
    });

    describe("Retry", () => {
      it("Resume", async () => {
        await insertActivities(101, ownerId, app);
        generator.evaluateChunk.mockRejectedValueOnce(
          new ReportGenerationError("INVALID_LLM_OUTPUT"),
        );
        const created = await report(owner).expect(202);
        await app.get(ReportJobRunner).awaitIdle();
        await expect(
          reportStatus(owner, created.body.id).then(({ body }) => body.status),
        ).resolves.toBe("failed");

        const retry = () =>
          request(app.getHttpServer())
            .post(`/api/v1/reports/${created.body.id}/retry`)
            .set(auth(owner));
        const responses = await Promise.all([retry(), retry()]);
        expect(responses.map(({ status }) => status).sort()).toEqual([
          202, 409,
        ]);
        await app.get(ReportJobRunner).awaitIdle();
        expect(
          await app
            .get(DataSource)
            .getRepository(ReportJob)
            .countBy({ id: created.body.id }),
        ).toBe(1);
        await expect(
          reportStatus(owner, created.body.id).then(({ body }) => body.status),
        ).resolves.toBe("completed");
      });
    });
  });

  describe("Delete a report", () => {
    it("Delete", async () => {
      await insertActivities(101, ownerId, app);
      const started = deferred<void>();
      const evaluation = deferred<{
        summary: string;
        highlights: [];
        provider: string;
        model: string;
      }>();
      generator.evaluateChunk.mockImplementation(() => {
        started.resolve();
        return evaluation.promise;
      });
      const created = await report(owner).expect(202);
      await started.promise;
      const signal = generator.evaluateChunk.mock.calls[0][0].signal;
      await request(app.getHttpServer())
        .delete(`/api/v1/reports/${created.body.id}`)
        .set(auth(owner))
        .expect(204);
      expect(signal?.aborted).toBe(true);
      evaluation.resolve({
        summary: "late",
        highlights: [],
        provider: "fake",
        model: "fake",
      });
      await app.get(ReportJobRunner).awaitIdle();

      const memory = app.get(ReportMemoryRepository);
      await expect(
        memory.save(ownerId, memoryRow(created.body.id, ownerId, 0)),
      ).rejects.toThrow();
      await expect(memory.list(ownerId, created.body.id)).resolves.toHaveLength(
        0,
      );
      expect(generator.evaluateChunk).toHaveBeenCalledTimes(1);
      expect(generator.writeFinal).not.toHaveBeenCalled();
    });
  });

  it("Second active report is rejected", async () => {
    generator.evaluateChunk.mockImplementation(
      () => new Promise(() => undefined),
    );
    await insertActivities(101, ownerId, app);
    await report(owner).expect(202);
    await report(owner)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe("REPORT_IN_PROGRESS");
        expect(body.id).toBeDefined();
      });
  });

  it("Retry of queued report is rejected", async () => {
    generator.evaluateChunk.mockImplementation(
      () => new Promise(() => undefined),
    );
    await insertActivities(101, ownerId, app);
    const created = await report(owner).expect(202);
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${created.body.id}/retry`)
      .set(auth(owner))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("REPORT_NOT_RETRYABLE"));
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
    const rows = Array.from({ length: 3001 }, (_, index) => ({
      userId: ownerId,
      date: "2026-11-16",
      title: `Activity ${index}`,
      description: null,
      referenceUrls: [],
      tags: [],
      project: null,
    }));
    for (let index = 0; index < rows.length; index += 400) {
      await app
        .get(DataSource)
        .getRepository(Activity)
        .insert(rows.slice(index, index + 400));
    }
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
      generator.generate.mock.calls[0][0].activities
        .map((item: { title: string }) => item.title)
        .sort(),
    ).toEqual(["Match second", "Match wanted"]);
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
    generator.generate.mockRejectedValueOnce(
      new ReportGenerationError("LLM_UNAVAILABLE"),
    );
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
  generate = jest.fn().mockResolvedValue({
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
  evaluateChunk = jest.fn().mockResolvedValue({
    summary: "Summary",
    highlights: [],
    provider: "ollama",
    model: "test",
  });
  writeFinal = jest.fn().mockResolvedValue({
    markdown: "# Final report",
    provider: "ollama",
    model: "test",
  });
}

async function bootApp(generator: FakeGenerator): Promise<INestApplication> {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REPORT_GENERATOR)
    .useValue(generator)
    .compile();
  const app = module.createNestApplication();
  currentApp = app;
  configureHttp(app);
  await app.init();
  return app;
}

function seedJob(
  userId: string,
  status: ReportJob["status"],
  activityIds: string[],
): ReportJob {
  return {
    id: randomUUID(),
    userId,
    status,
    params: {
      from: "2026-11-01",
      to: "2026-11-30",
      language: "en",
      style: "summary",
    },
    activityIds,
    chunkSize: 100,
    progressDone: 0,
    progressTotal: Math.ceil(activityIds.length / 100),
    markdown: null,
    provider: null,
    model: null,
    errorCode: null,
    errorChunk: null,
    createdAt: new Date(),
    finishedAt: null,
  };
}

async function reportActivityIds(userId: string): Promise<string[]> {
  const rows = await currentApp
    .get(DataSource)
    .getRepository(Activity)
    .find({
      select: { id: true },
      where: { userId },
      order: { createdAt: "ASC" },
    });
  return rows.map(({ id }) => id);
}

function memoryRow(
  reportId: string,
  userId: string,
  chunkIndex: number,
): ReportMemory {
  return {
    reportId,
    userId,
    chunkIndex,
    dateFrom: "2026-11-16",
    dateTo: "2026-11-16",
    activityCount: 100,
    summary: "Stored summary",
    highlights: [],
    byProject: { none: 100 },
    byDay: { "2026-11-16": 100 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function insertActivities(
  count: number,
  userId: string,
  app: INestApplication,
): Promise<void> {
  const rows = Array.from({ length: count }, (_, index) => ({
    userId,
    date: "2026-11-16",
    title: `Activity ${index}`,
    description: null,
    referenceUrls: [],
    tags: [],
    project: null,
  }));
  for (let index = 0; index < rows.length; index += 400) {
    await app
      .get(DataSource)
      .getRepository(Activity)
      .insert(rows.slice(index, index + 400));
  }
}

function reportStatus(token: string, id: string) {
  return request(appServer()).get(`/api/v1/reports/${id}`).set(auth(token));
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
