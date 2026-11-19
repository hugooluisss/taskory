import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";
import { Logger } from "@nestjs/common";
import { ReportJob } from "./entities/report-job.entity";

describe("Report generation", () => {
  let activities: jest.Mocked<
    Pick<
      ActivitiesService,
      "findReportSnapshot" | "findReportChunk" | "findReportProjects"
    >
  >;
  let generator: {
    generate: jest.Mock;
    hasProvider: jest.Mock;
    configuration: jest.Mock;
  };
  let service: ReportsService;
  let jobs: {
    enqueue: jest.Mock;
    get: jest.Mock;
    retry: jest.Mock;
    delete: jest.Mock;
    createCompleted: jest.Mock;
    list: jest.Mock;
    update: jest.Mock;
    clearMemory: jest.Mock;
    findByShareHash: jest.Mock;
  };
  let queue: {
    enqueue: jest.Mock;
    cancel: jest.Mock;
    finishCancellation: jest.Mock;
    resumeQueued: jest.Mock;
  };
  let runs: { save: jest.Mock; list: jest.Mock };
  let users: { findById: jest.Mock; saveCustomReportPrompt: jest.Mock };
  const request: CreateReportDto = {
    from: "2026-01-01",
    to: "2026-01-31",
    language: "es",
    style: "detailed",
  };
  const reportParams = {
    from: "2026-01-01",
    to: "2026-01-31",
    language: "en" as const,
    style: "summary" as const,
  };
  function reportJob(overrides: Partial<ReportJob> = {}): ReportJob {
    return {
      id: "report",
      userId: "user",
      status: "completed",
      params: reportParams,
      activityIds: ["activity"],
      chunkSize: 100,
      progressDone: 0,
      progressTotal: 1,
      markdown: null,
      provider: "ollama",
      model: "test",
      errorCode: null,
      errorChunk: null,
      createdAt: new Date(),
      finishedAt: null,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 0,
      shareTokenHash: null,
      shareExpiresAt: null,
      ...overrides,
    };
  }
  const activity = {
    id: "id",
    date: "2026-01-02",
    title: "Entrega",
    description: null,
    referenceUrls: [],
    tags: ["api"],
    projects: [
      {
        id: "p1",
        name: "A",
        description: null,
        userId: "user",
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    userId: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Activity;

  beforeEach(() => {
    activities = {
      findReportSnapshot: jest.fn().mockResolvedValue([{ id: activity.id }]),
      findReportChunk: jest.fn().mockResolvedValue([activity]),
      findReportProjects: jest
        .fn()
        .mockResolvedValue([{ id: "p1", name: "A", description: null }]),
    };
    generator = {
      generate: jest.fn().mockResolvedValue({
        markdown: "# Informe",
        provider: "ollama",
        model: "test",
        promptTokens: 10,
        completionTokens: 2,
        totalTokens: 12,
      }),
      hasProvider: jest.fn().mockReturnValue(true),
      configuration: jest
        .fn()
        .mockReturnValue({ provider: "ollama", model: "test" }),
    };
    jobs = {
      enqueue: jest
        .fn()
        .mockResolvedValue({ id: "job", status: "queued", progressTotal: 2 }),
      get: jest.fn().mockResolvedValue({ id: "job" }),
      retry: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      createCompleted: jest.fn().mockResolvedValue({ id: "report-id" }),
      list: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockResolvedValue(undefined),
      clearMemory: jest.fn().mockResolvedValue(undefined),
      findByShareHash: jest.fn().mockResolvedValue(null),
    };
    queue = {
      enqueue: jest.fn(),
      cancel: jest.fn(),
      finishCancellation: jest.fn(),
      resumeQueued: jest.fn(),
    };
    runs = { save: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    users = {
      findById: jest.fn().mockResolvedValue({ customReportPrompt: null }),
      saveCustomReportPrompt: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReportsService(
      activities as unknown as ActivitiesService,
      generator as never,
      jobs as never,
      queue,
      runs as never,
      users as never,
    );
  });

  it("Successful report", async () => {
    await expect(service.create("user", request)).resolves.toEqual({
      markdown: "# Informe",
      provider: "ollama",
      model: "test",
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12,
      costUsd: 0,
      activityCount: 1,
      id: "report-id",
      shareUrl: expect.stringContaining("/shared/"),
      shareExpiresAt: expect.any(Date),
    });
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es", style: "detailed" }),
    );
  });

  it("Does not record a failed run when saving a completed run fails", async () => {
    const error = new Error("database unavailable");
    runs.save.mockRejectedValue(error);
    await expect(service.create("user", request)).rejects.toBe(error);
    expect(runs.save).toHaveBeenCalledTimes(1);
    expect(runs.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("Preserves the generation error and logs when failed-run recording fails", async () => {
    const generationError = new Error("provider failed");
    const recordingError = new Error("database unavailable");
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();
    generator.generate.mockRejectedValue(generationError);
    runs.save.mockRejectedValue(recordingError);
    try {
      await expect(service.create("user", request)).rejects.toBe(
        generationError,
      );
      expect(log).toHaveBeenCalledWith(
        "Failed to record failed report run",
        recordingError.stack,
      );
    } finally {
      log.mockRestore();
    }
  });

  it("Spanish detailed report", async () => {
    await service.create("user", request);
    expect(generator.generate.mock.calls[0][0]).toMatchObject({
      language: "es",
      style: "detailed",
    });
  });

  it("Generate with custom prompt", async () => {
    await service.create("user", {
      ...request,
      style: "custom",
      customPrompt: "  Group by project.  ",
    });
    expect(users.saveCustomReportPrompt).toHaveBeenCalledWith(
      "user",
      "Group by project.",
    );
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "custom",
        customPrompt: "Group by project.",
      }),
    );
  });

  it("Prompt only matters for custom", async () => {
    await service.create("user", { ...request, customPrompt: "Ignored" });
    expect(users.saveCustomReportPrompt).not.toHaveBeenCalled();
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty(
      "customPrompt",
    );
  });

  it("List styles returns saved custom prompt", async () => {
    users.findById.mockResolvedValue({ customReportPrompt: "Saved" });
    await expect(service.listStyles("user")).resolves.toMatchObject({
      styles: [
        {
          id: "summary",
          prompt: { es: expect.any(String), en: expect.any(String) },
        },
        {
          id: "detailed",
          prompt: { es: expect.any(String), en: expect.any(String) },
        },
      ],
      customPrompt: "Saved",
    });
  });

  it("Lists summaries without markdown", async () => {
    jobs.list.mockResolvedValue([
      [
        reportJob({
          params: {
            ...reportParams,
            projects: [{ id: "p1", name: "Alpha", description: null }],
          },
        }),
      ],
      1,
    ]);
    await expect(service.list("user", 2, 10)).resolves.toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
      items: [{ projects: [{ id: "p1", name: "Alpha" }], activityCount: 1 }],
    });
    expect(jobs.list).toHaveBeenCalledWith("user", 10, 10);
  });

  it("Returns custom prompt and localized error in detail", async () => {
    jobs.get.mockResolvedValue(
      reportJob({
        params: { ...reportParams, style: "custom", customPrompt: "Custom" },
        status: "failed",
        errorCode: "UNKNOWN",
        errorChunk: 2,
      }),
    );
    const result = await service.detail("user", "report", "es-MX");
    expect(result).toMatchObject({
      markdown: null,
      customPrompt: "Custom",
      error: { code: "UNKNOWN", chunk: 2, message: expect.any(String) },
      progress: { done: 0, total: 1 },
    });
  });

  it("Renews the share token hash and expiry", async () => {
    const result = await service.renewShare("user", "report");
    expect(result.shareUrl).toMatch(
      /^http:\/\/localhost:4200\/shared\/[A-Za-z0-9_-]{43}$/,
    );
    const update = jobs.update.mock.calls[0][2];
    expect(update.shareTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(update.shareTokenHash).not.toBe(result.shareUrl.split("/").at(-1));
    expect(update.shareExpiresAt).toEqual(result.shareExpiresAt);
  });

  it("Regenerate with custom prompt keeps the report snapshot", async () => {
    jobs.get.mockResolvedValue(reportJob({ status: "completed" }));
    await expect(
      service.regenerate("user", "report", {
        style: "custom",
        customPrompt: "  Group  ",
      }),
    ).resolves.toMatchObject({
      id: "report",
      status: "queued",
      progress: { total: 1 },
    });
    expect(jobs.clearMemory).toHaveBeenCalledWith("user", "report");
    expect(jobs.update).toHaveBeenCalledWith(
      "user",
      "report",
      expect.objectContaining({
        status: "queued",
        params: expect.objectContaining({ customPrompt: "Group" }),
      }),
    );
    expect(users.saveCustomReportPrompt).toHaveBeenCalledWith("user", "Group");
    expect(queue.enqueue).toHaveBeenCalledWith("report", "user");
  });

  it("Regenerate refuses active reports and unavailable providers", async () => {
    jobs.get.mockResolvedValue(reportJob({ status: "running" }));
    await expect(
      service.regenerate("user", "report", { style: "summary" }),
    ).rejects.toMatchObject({ status: 409 });
    jobs.get.mockResolvedValue(reportJob({ status: "completed" }));
    generator.hasProvider.mockReturnValue(false);
    await expect(
      service.regenerate("user", "report", { style: "summary" }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("Regenerate custom prompt validation follows saved prompt rules", async () => {
    jobs.get.mockResolvedValue(reportJob({ status: "completed" }));
    await expect(
      service.regenerate("user", "report", {
        style: "custom",
        customPrompt: " ",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(users.saveCustomReportPrompt).not.toHaveBeenCalled();
  });

  it("Uses configured provider and model", async () => {
    await service.create("user", request);
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty("provider");
    expect(generator.generate.mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("No activities", async () => {
    activities.findReportSnapshot.mockResolvedValue([]);
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 422,
      response: { code: "NO_ACTIVITIES" },
    });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Inverted range", async () => {
    await expect(
      service.create("user", { ...request, from: "2026-02-01" }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "VALIDATION_ERROR" },
    });
    expect(activities.findReportSnapshot).not.toHaveBeenCalled();
  });

  it("Range too large", async () => {
    activities.findReportSnapshot.mockResolvedValue(
      Array.from({ length: 3001 }, (_, index) => ({ id: `${index}` })),
    );
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 422,
      response: { code: "RANGE_TOO_LARGE" },
    });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Tag filter", async () => {
    await service.create("user", { ...request, tags: ["api", "bug"] });
    expect(activities.findReportSnapshot).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({ tags: ["api", "bug"] }),
    );
  });

  it("Configured provider unavailable", async () => {
    generator.hasProvider.mockReturnValue(false);
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 502,
      response: { code: "LLM_UNAVAILABLE" },
    });
    expect(activities.findReportSnapshot).not.toHaveBeenCalled();
  });

  it("Provider down", async () => {
    generator.generate.mockRejectedValue(
      new ReportGenerationError("LLM_UNAVAILABLE"),
    );
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 502,
      response: { code: "LLM_UNAVAILABLE" },
    });
  });

  it("Passes cancellation errors through", async () => {
    const error = new ReportGenerationError("CANCELLED");
    generator.generate.mockRejectedValue(error);
    await expect(service.create("user", request)).rejects.toBe(error);
  });

  it("Passes unexpected provider errors through", async () => {
    const error = new Error("unexpected");
    generator.generate.mockRejectedValue(error);
    await expect(service.create("user", request)).rejects.toBe(error);
  });

  it("Chunked generation", async () => {
    activities.findReportSnapshot.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({ id: `${index}` })),
    );
    await expect(service.create("user", request)).resolves.toEqual({
      id: "job",
      status: "queued",
      progress: { done: 0, total: 2 },
      shareUrl: expect.stringContaining("/shared/"),
      shareExpiresAt: expect.any(Date),
    });
    expect(activities.findReportChunk).not.toHaveBeenCalled();
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Completed report status includes the result", async () => {
    jobs.get.mockResolvedValue({
      id: "job",
      status: "completed",
      progressDone: 2,
      progressTotal: 2,
      createdAt: new Date(),
      finishedAt: new Date(),
      markdown: "# done",
      provider: "ollama",
      model: "test",
      activityIds: ["a", "b"],
    });
    await expect(service.status("user", "job")).resolves.toMatchObject({
      status: "completed",
      markdown: "# done",
      activityCount: 2,
    });
  });

  it("Failed report status includes the chunk error", async () => {
    jobs.get.mockResolvedValue({
      id: "job",
      status: "failed",
      progressDone: 1,
      progressTotal: 2,
      createdAt: new Date(),
      finishedAt: new Date(),
      errorCode: "LLM_UNAVAILABLE",
      errorChunk: 1,
    });
    await expect(service.status("user", "job")).resolves.toMatchObject({
      status: "failed",
      error: { code: "LLM_UNAVAILABLE", chunk: 1 },
    });
  });

  it("Retry and delete delegate to the job lifecycle", async () => {
    jobs.retry.mockResolvedValue({
      id: "job",
      status: "queued",
      progressDone: 1,
      progressTotal: 2,
    });
    await expect(service.retry("user", "job")).resolves.toEqual({
      id: "job",
      status: "queued",
      progress: { done: 1, total: 2 },
    });
    await service.delete("user", "job");
    expect(jobs.delete).toHaveBeenCalledWith("user", "job");
  });
});
import { ReportGenerationError } from "./ports/report-generation-error";
