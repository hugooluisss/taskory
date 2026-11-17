import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";

describe("Report generation", () => {
  let activities: jest.Mocked<Pick<ActivitiesService, "findForReport">>;
  let generator: {
    generate: jest.Mock;
    listProviders: jest.Mock;
    hasProvider: jest.Mock;
  };
  let service: ReportsService;
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
    activities = { findForReport: jest.fn().mockResolvedValue([activity]) };
    generator = {
      generate: jest
        .fn()
        .mockResolvedValue({
          markdown: "# Informe",
          provider: "ollama",
          model: "test",
        }),
      listProviders: jest
        .fn()
        .mockResolvedValue([
          { id: "ollama", defaultModel: "test", available: true },
        ]),
      hasProvider: jest.fn().mockReturnValue(true),
    };
    service = new ReportsService(
      activities as unknown as ActivitiesService,
      generator as never,
    );
  });

  it("Successful report", async () => {
    await expect(service.create("user", request)).resolves.toEqual({
      markdown: "# Informe",
      provider: "ollama",
      model: "test",
      activityCount: 1,
    });
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ language: "es", style: "detailed" }),
    );
  });

  it("Spanish detailed report", async () => {
    await service.create("user", request);
    expect(generator.generate.mock.calls[0][0]).toMatchObject({
      language: "es",
      style: "detailed",
    });
  });

  it("No provider in request", async () => {
    await service.create("user", request);
    expect(generator.generate.mock.calls[0][0].provider).toBeUndefined();
  });

  it("No activities", async () => {
    activities.findForReport.mockResolvedValue([]);
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
    expect(activities.findForReport).not.toHaveBeenCalled();
  });

  it("Range too large", async () => {
    activities.findForReport.mockResolvedValue(
      Array.from({ length: 301 }, () => activity),
    );
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 422,
      response: { code: "RANGE_TOO_LARGE" },
    });
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("Tag filter", async () => {
    await service.create("user", { ...request, tags: ["api", "bug"] });
    expect(activities.findForReport).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({ tags: ["api", "bug"] }),
    );
  });

  it("Unknown provider", async () => {
    generator.hasProvider.mockReturnValue(false);
    activities.findForReport.mockResolvedValue([]);
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 400,
      response: { code: "UNKNOWN_PROVIDER" },
    });
    expect(activities.findForReport).not.toHaveBeenCalled();
  });

  it("Provider down", async () => {
    generator.generate.mockRejectedValue(new LlmUnavailableError("down"));
    await expect(service.create("user", request)).rejects.toMatchObject({
      status: 502,
      response: { code: "LLM_UNAVAILABLE" },
    });
  });

  it("Unreachable provider", async () => {
    await expect(service.listProviders()).resolves.toEqual([
      { id: "ollama", defaultModel: "test", available: true },
    ]);
  });
});
import { LlmUnavailableError } from "@taskory/llm";
