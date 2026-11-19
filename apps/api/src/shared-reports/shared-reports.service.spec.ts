import { SharedReportsRepository } from "./shared-reports.repository";
import { SharedReportsService } from "./shared-reports.service";

describe("Public shared report", () => {
  const job = {
    userId: "owner",
    activityIds: ["second", "missing", "first"],
    params: {
      from: "2026-01-01",
      to: "2026-01-31",
      language: "en",
      projects: [{ name: "Alpha" }],
    },
    shareExpiresAt: new Date(Date.now() + 60_000),
  };
  let repository: jest.Mocked<
    Pick<SharedReportsRepository, "findByHash" | "activitiesFor">
  >;
  let service: SharedReportsService;

  beforeEach(() => {
    repository = {
      findByHash: jest.fn().mockResolvedValue(job),
      activitiesFor: jest.fn().mockResolvedValue([
        {
          id: "second",
          date: "2026-01-02",
          title: "Second",
          description: null,
          projects: [],
          tags: [],
          referenceUrls: [],
        },
        {
          id: "first",
          date: "2026-01-01",
          title: "First",
          description: "Text",
          projects: [{ name: "Alpha" }],
          tags: ["safe"],
          referenceUrls: ["https://example.test"],
        },
      ]),
    };
    service = new SharedReportsService(repository as never);
  });

  it("Valid link lists the activity snapshot without private report fields", async () => {
    const result = await service.get("A".repeat(43));
    expect(result).toEqual({
      period: { from: "2026-01-01", to: "2026-01-31" },
      language: "en",
      projects: ["Alpha"],
      activities: [
        expect.objectContaining({ title: "First" }),
        expect.objectContaining({ title: "Second" }),
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/owner|markdown|cost|token|id/);
  });

  it("Hostile token lengths and unknown tokens return 404", async () => {
    await expect(service.get("x".repeat(5000))).rejects.toMatchObject({
      status: 404,
    });
    repository.findByHash.mockResolvedValue(null);
    await expect(service.get("A".repeat(43))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("Expired link returns SHARE_EXPIRED", async () => {
    repository.findByHash.mockResolvedValue({
      ...job,
      shareExpiresAt: new Date(Date.now() - 1),
    } as never);
    await expect(service.get("A".repeat(43))).rejects.toMatchObject({
      status: 410,
      response: { code: "SHARE_EXPIRED" },
    });
  });
});
