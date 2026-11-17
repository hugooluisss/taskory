import { ActivitiesRepository } from "./activities.repository";
import { ActivitiesService } from "./activities.service";

describe("Activity creation", () => {
  it("Minimal activity", async () => {
    const repository = fakeRepository();
    const service = createService(repository);

    await expect(
      service.create("u1", { date: "2026-11-16", title: "Work" }),
    ).resolves.toMatchObject({
      referenceUrls: [],
      tags: [],
      description: null,
      project: null,
    });
  });

  it("Multiple reference URLs", async () => {
    const repository = fakeRepository();
    const service = createService(repository);
    const referenceUrls = ["https://one.example", "https://two.example"];

    await service.create("u1", {
      date: "2026-11-16",
      title: "Links",
      referenceUrls,
    });

    expect(repository.create).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ referenceUrls }),
    );
  });
});

describe("Tag normalization", () => {
  it("Duplicate tags", async () => {
    const repository = fakeRepository();
    const service = createService(repository);

    await service.create("u1", {
      date: "2026-11-16",
      title: "Tags",
      tags: ["API", "api ", "Bug"],
    });

    expect(repository.create).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ tags: ["api", "bug"] }),
    );
  });

  it("Normalizes tag filters before repository lookup", async () => {
    const repository = fakeRepository();
    const service = createService(repository);

    await service.list("u1", {
      tag: " API ",
      page: 1,
      limit: 50,
    });

    expect(repository.list).toHaveBeenCalledWith("u1", {
      tag: "api",
      page: 1,
      limit: 50,
    });
  });
});

describe("Activity read, update and delete", () => {
  it("Partial update", async () => {
    const activity = { id: "a1", title: "Changed", tags: ["bug"] };
    const repository = fakeRepository({
      update: jest.fn().mockResolvedValue(activity),
      findById: jest.fn().mockResolvedValue(activity),
    });
    const service = createService(repository);

    await expect(
      service.update("u1", "a1", {
        title: "Changed",
        tags: [" BUG ", "bug"],
      }),
    ).resolves.toBe(activity);
    expect(repository.update).toHaveBeenCalledWith(
      "u1",
      "a1",
      expect.objectContaining({ title: "Changed", tags: ["bug"] }),
    );
  });

  it("Delete", async () => {
    const repository = fakeRepository({
      delete: jest.fn().mockResolvedValue(true),
    });
    const service = createService(repository);

    await expect(service.delete("u1", "a1")).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith("u1", "a1");
  });
});

describe("Activity listing and filters", () => {
  it("Date range", async () => {
    const repository = fakeRepository();
    const service = createService(repository);
    const filters = {
      from: "2026-11-01",
      to: "2026-11-15",
      page: 1,
      limit: 50,
    };

    await service.list("u1", filters);

    expect(repository.list).toHaveBeenCalledWith("u1", filters);
  });

  it("Invalid filter date", async () => {
    const repository = fakeRepository();
    const service = createService(repository);
    const invalidFilters = [
      { from: "2026-02-30", page: 1, limit: 50 },
      { to: "0000-01-01", page: 1, limit: 50 },
    ];

    for (const filters of invalidFilters) {
      await expect(service.list("u1", filters)).rejects.toMatchObject({
        response: { code: "VALIDATION_ERROR" },
      });
    }
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("Reversed date range", async () => {
    const repository = fakeRepository();
    const service = createService(repository);

    await expect(
      service.list("u1", {
        from: "2026-11-02",
        to: "2026-11-01",
        page: 1,
        limit: 50,
      }),
    ).rejects.toMatchObject({
      response: { code: "VALIDATION_ERROR" },
    });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe("Per-user isolation", () => {
  it("Foreign activity", async () => {
    const repository = fakeRepository({
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    });
    const service = createService(repository);

    await expect(service.findById("u2", "a1")).rejects.toMatchObject({
      response: { code: "NOT_FOUND" },
    });
    await expect(
      service.update("u2", "a1", { title: "Changed" }),
    ).rejects.toMatchObject({ response: { code: "NOT_FOUND" } });
    await expect(service.delete("u2", "a1")).rejects.toMatchObject({
      response: { code: "NOT_FOUND" },
    });
  });
});

describe("Activity metadata", () => {
  it("Suggestions", async () => {
    const repository = fakeRepository();
    const service = createService(repository);

    await service.meta("u1");

    expect(repository.meta).toHaveBeenCalledWith("u1");
  });
});

function fakeRepository(overrides: Record<string, unknown> = {}) {
  return {
    create: jest.fn(async (_userId, values) => ({ ...values, id: "a1" })),
    findById: jest.fn().mockResolvedValue({ id: "a1" }),
    update: jest.fn().mockResolvedValue({ id: "a1" }),
    delete: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
    }),
    meta: jest.fn().mockResolvedValue({ projects: [], tags: [] }),
    ...overrides,
  } as unknown as ActivitiesRepository;
}

function createService(repository: ActivitiesRepository): ActivitiesService {
  return new ActivitiesService(
    repository,
    () => new Date("2026-11-20T00:00:00Z"),
  );
}
