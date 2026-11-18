import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { ReportJob } from "../src/reports/entities/report-job.entity";
import { ReportMemory } from "../src/reports/entities/report-memory.entity";
import { ReportGenerationError } from "../src/reports/ports/report-generation-error";
import { ReportJobRunner } from "../src/reports/report-job.runner";
import { ReportMemoryRepository } from "../src/reports/report-memory.repository";
import { AppModule } from "../src/app.module";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "./mysql-test-database";
import { Activity } from "../src/activities/entities/activity.entity";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";
import { configureHttp } from "../src/http-setup";

async function provisionDatabase(): Promise<string> {
  const source = await createMySqlTestDatabase();
  const database = source.options.database as string;
  await source.destroy();
  return database;
}

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
    databasePath = await provisionDatabase();
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
    await dropMySqlTestDatabase(databasePath);
  });

  it("Successful report", async () => {
    await create(owner, { date: "2026-11-16", title: "Owned" });
    const response = await report(owner, {
      provider: "deepseek",
      model: "caller-choice",
    }).expect(200);
    expect(response.body).toEqual({
      markdown: "# Report",
      provider: "ollama",
      model: "test",
      totalTokens: 12,
      promptTokens: 12,
      completionTokens: 0,
      costUsd: 0,
      activityCount: 1,
    });
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty("provider");
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("List styles", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/reports/styles")
      .set(auth(owner))
      .expect(200);
    expect(response.body).toMatchObject({
      styles: [
        { id: "summary", prompt: { es: expect.any(String), en: expect.any(String) } },
        { id: "detailed", prompt: { es: expect.any(String), en: expect.any(String) } },
      ],
      customPrompt: null,
    });
  });

  it("Generate with custom prompt", async () => {
    await create(owner, { date: "2026-11-16", title: "Owned" });
    await report(owner, { style: "custom", customPrompt: "  Group by project.  " }).expect(200);
    expect(generator.generate.mock.calls[0][0]).toMatchObject({
      style: "custom",
      customPrompt: "Group by project.",
    });
    const styles = await request(app.getHttpServer())
      .get("/api/v1/reports/styles")
      .set(auth(owner))
      .expect(200);
    expect(styles.body.customPrompt).toBe("Group by project.");
    const history = await request(app.getHttpServer())
      .get("/api/v1/reports/runs")
      .set(auth(owner))
      .expect(200);
    expect(history.body.items[0].style).toBe("custom");
    expect(history.body.items[0]).not.toHaveProperty("customPrompt");
  });

  it("Custom without prompt", async () => {
    for (const customPrompt of [undefined, "   ", "x".repeat(2001)]) {
      await report(owner, { style: "custom", customPrompt })
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
    }
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Prompt only matters for custom", async () => {
    await create(owner, { date: "2026-11-16", title: "Owned" });
    await report(owner, { customPrompt: "Ignore this" }).expect(200);
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty("customPrompt");
    const styles = await request(app.getHttpServer())
      .get("/api/v1/reports/styles")
      .set(auth(owner))
      .expect(200);
    expect(styles.body.customPrompt).toBeNull();
  });

  it("Report run history is paginated and isolated by owner", async () => {
    await create(owner, { date: "2026-11-16", title: "Owner activity" });
    await create(other, { date: "2026-11-16", title: "Other activity" });
    await report(owner).expect(200);
    await report(other).expect(200);

    const history = await request(app.getHttpServer())
      .get("/api/v1/reports/runs?page=1&limit=1")
      .set(auth(owner))
      .expect(200);
    expect(history.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0]).toMatchObject({
      userId: ownerId,
      provider: "ollama",
      model: "test",
      totalTokens: 12,
      promptTokens: 12,
      completionTokens: 0,
      costUsd: 0,
      activityCount: 1,
      status: "completed",
    });
  });

  it("Persists failed synchronous usage", async () => {
    await create(owner, { date: "2026-11-16", title: "Consumed activity" });
    generator.generate.mockRejectedValueOnce(
      new ReportGenerationError("LLM_UNAVAILABLE", {
        promptTokens: 5,
        completionTokens: 2,
        totalTokens: 7,
      }),
    );
    await report(owner).expect(502);
    const history = await request(app.getHttpServer())
      .get("/api/v1/reports/runs")
      .set(auth(owner))
      .expect(200);
    expect(history.body.items[0]).toMatchObject({
      status: "failed",
      promptTokens: 5,
      completionTokens: 2,
      totalTokens: 7,
      costUsd: 0,
    });
  });

  describe("Report project selection", () => {
    let alphaId: string;
    let betaId: string;
    beforeEach(async () => {
      alphaId = await createProject(owner, "Alpha");
      betaId = await createProject(owner, "Beta");
      await create(owner, {
        date: "2026-11-16",
        title: "Alpha",
        projectIds: [alphaId, betaId],
      });
      await create(owner, {
        date: "2026-11-17",
        title: "Beta",
        projectIds: [betaId],
      });
      await create(owner, { date: "2026-11-18", title: "Unassigned" });
    });

    it("One project", async () => {
      await report(owner, { projectIds: [alphaId] })
        .expect(200)
        .expect(({ body }) => expect(body.activityCount).toBe(1));
    });

    it("Several projects", async () => {
      await report(owner, { projectIds: [alphaId, betaId, alphaId] })
        .expect(200)
        .expect(({ body }) => expect(body.activityCount).toBe(2));
      expect(generator.generate.mock.calls[0][0].projectIds).toEqual([
        alphaId,
        betaId,
      ]);
    });

    it("Prompt carries project context", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${alphaId}`)
        .set(auth(owner))
        .send({ description: "  Delivery context  " })
        .expect(200);
      await report(owner, { projectIds: [alphaId] }).expect(200);
      expect(generator.generate.mock.calls[0][0].projects).toEqual([
        { id: alphaId, name: "Alpha", description: "Delivery context" },
      ]);
      await report(owner, { projectIds: [] }).expect(200);
      expect(generator.generate.mock.calls[1][0].projects).toEqual(expect.arrayContaining([
        { id: alphaId, name: "Alpha", description: "Delivery context" },
        { id: betaId, name: "Beta", description: null },
      ]));
    });

    it("None means all", async () => {
      await report(owner, { projectIds: [] })
        .expect(200)
        .expect(({ body }) => {
          expect(body.activityCount).toBe(3);
        });
    });

    it("Too many or invalid projects", async () => {
      for (const projectIds of [["bad-id"], [null], Array(21).fill(alphaId)]) {
        await report(owner, { projectIds })
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
        promptTokens: 14,
        completionTokens: 0,
        totalTokens: 14,
        costUsd: 0,
        provider: "ollama",
        model: "test",
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
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
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
        totalTokens: 3,
        promptTokens: 3,
        completionTokens: 0,
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
      const history = await request(app.getHttpServer())
        .get("/api/v1/reports/runs")
        .set(auth(owner))
        .expect(200);
      expect(history.body.items[0]).toMatchObject({
        jobId: interrupted.id,
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
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
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
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
        totalTokens: 3,
        promptTokens: 3,
        completionTokens: 0,
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
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
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
        totalTokens: 3,
        promptTokens: 3,
        completionTokens: 0,
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

  it("Inverted range", async () => {
    await report(owner, { from: "2026-12-01", to: "2026-11-30" })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
    expect(generator.generate).not.toHaveBeenCalled();
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

  it("Configured provider unavailable", async () => {
    generator.hasProvider.mockReturnValue(false);
    await create(owner, { date: "2026-11-16", title: "Owned" });
    await report(owner)
      .expect(502)
      .expect(({ body }) => expect(body.code).toBe("LLM_UNAVAILABLE"));
  });

  it("Missing token", async () => {
    await request(app.getHttpServer()).get("/api/v1/reports/runs").expect(401);
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
    totalTokens: 12,
    promptTokens: 12,
    completionTokens: 0,
  });
  hasProvider = jest.fn(() => true);
  configuration = jest.fn(() => ({ provider: "ollama", model: "test" }));
  evaluateChunk = jest.fn().mockResolvedValue({
    summary: "Summary",
    highlights: [],
    provider: "ollama",
    model: "test",
    totalTokens: 3,
    promptTokens: 3,
    completionTokens: 0,
  });
  writeFinal = jest.fn().mockResolvedValue({
    markdown: "# Final report",
    provider: "ollama",
    model: "test",
    totalTokens: 5,
    promptTokens: 5,
    completionTokens: 0,
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
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    costMicros: 0,
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
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
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
    databasePath = await provisionDatabase();
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
    await dropMySqlTestDatabase(databasePath);
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

async function createProject(token: string, name: string): Promise<string> {
  const response = await request(currentApp.getHttpServer())
    .post("/api/v1/projects")
    .set(auth(token))
    .send({ name })
    .expect(201);
  return response.body.id as string;
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
