import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";
import { Logger } from "@nestjs/common";

describe("Report generation", () => {
  let activities: jest.Mocked<
    Pick<ActivitiesService, "findReportSnapshot" | "findReportChunk">
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
  };
  let queue: {
    enqueue: jest.Mock;
    cancel: jest.Mock;
    finishCancellation: jest.Mock;
    resumeQueued: jest.Mock;
  };
  let runs: { save: jest.Mock; list: jest.Mock };
  const request: CreateReportDto = {
    from: "2026-01-01",
    to: "2026-01-31",
    language: "es",
    style: "detailed",
  };
  const activity = {
    id: "id",
    date: "2026-01-02",
    title: "Entrega",
    description: null,
    referenceUrls: [],
    tags: ["api"],
    project: "A",
    userId: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Activity;

  beforeEach(() => {
    activities = {
      findReportSnapshot: jest.fn().mockResolvedValue([{ id: activity.id }]),
      findReportChunk: jest.fn().mockResolvedValue([activity]),
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
    };
    queue = {
      enqueue: jest.fn(),
      cancel: jest.fn(),
      finishCancellation: jest.fn(),
      resumeQueued: jest.fn(),
    };
    runs = { save: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    service = new ReportsService(
      activities as unknown as ActivitiesService,
      generator as never,
      jobs as never,
      queue,
      runs as never,
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
