import { DataSource } from "typeorm";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "../../test/mysql-test-database";
import { Activity } from "./entities/activity.entity";
import { ActivitiesRepository } from "./activities.repository";

describe("Activity listing and filters", () => {
  let source: DataSource;
  let repository: ActivitiesRepository;

  beforeEach(async () => {
    source = await createMySqlTestDatabase();
    repository = new ActivitiesRepository(source.getRepository(Activity));
  });

  afterEach(async () => {
    const database = source.options.database as string;
    await source.destroy();
    await dropMySqlTestDatabase(database);
  });

  it("Date range", async () => {
    await repository.create("u1", activity("2026-10-31", "Before"));
    await repository.create("u1", activity("2026-11-01", "Start"));
    await repository.create("u1", activity("2026-11-15", "End"));
    await repository.create("u1", activity("2026-11-16", "After"));
    await repository.create("u2", activity("2026-11-05", "Foreign"));

    const result = await repository.list("u1", {
      from: "2026-11-01",
      to: "2026-11-15",
      page: 1,
      limit: 50,
    });

    expect(result.items.map((item) => item.title).sort()).toEqual([
      "End",
      "Start",
    ]);
  });

  it("Text search", async () => {
    await repository.create("u1", {
      ...activity("2026-11-01", "Other title"),
      description: "login happened",
    });
    await repository.create("u1", activity("2026-11-02", "unrelated"));

    const result = await repository.list("u1", {
      q: "login",
      page: 1,
      limit: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe("login happened");
  });

  it("Orders equal dates by createdAt descending", async () => {
    const first = await repository.create(
      "u1",
      activity("2026-11-16", "First"),
    );
    const second = await repository.create(
      "u1",
      activity("2026-11-16", "Second"),
    );
    await source.getRepository(Activity).update(first.id, {
      createdAt: new Date("2026-11-16T10:00:00Z"),
    });
    await source.getRepository(Activity).update(second.id, {
      createdAt: new Date("2026-11-16T11:00:00Z"),
    });

    const result = await repository.list("u1", { page: 1, limit: 50 });

    expect(result.items.map((item) => item.id)).toEqual([second.id, first.id]);
  });

  it("Matches tags exactly", async () => {
    await repository.create("u1", {
      ...activity("2026-11-01", "Exact"),
      tags: ["api"],
    });
    await repository.create("u1", {
      ...activity("2026-11-02", "Longer"),
      tags: ["api-v2"],
    });

    const result = await repository.list("u1", {
      tag: "api",
      page: 1,
      limit: 50,
    });

    expect(result.items.map((item) => item.title)).toEqual(["Exact"]);
  });

  it("Report projects match any selected value", async () => {
    await repository.create("u1", {
      ...activity("2026-11-01", "Alpha"),
      project: "Alpha",
    });
    await repository.create("u1", {
      ...activity("2026-11-02", "Beta"),
      project: "Beta",
    });
    await repository.create("u1", {
      ...activity("2026-11-03", "Secret"),
      project: "Secret",
    });

    const result = await repository.findReportSnapshot("u1", {
      from: "2026-11-01",
      to: "2026-11-30",
      projects: ["Alpha", "Beta"],
    });

    expect(result).toHaveLength(2);
  });
});

describe("Activity metadata", () => {
  let source: DataSource;
  let repository: ActivitiesRepository;

  beforeEach(async () => {
    source = await createMySqlTestDatabase();
    repository = new ActivitiesRepository(source.getRepository(Activity));
  });

  afterEach(async () => {
    const database = source.options.database as string;
    await source.destroy();
    await dropMySqlTestDatabase(database);
  });

  it("Suggestions", async () => {
    await repository.create("u1", {
      ...activity("2026-11-01", "One"),
      tags: ["api"],
      project: "A",
    });
    await repository.create("u1", {
      ...activity("2026-11-02", "Two"),
      tags: ["api", "bug"],
      project: "A",
    });
    await repository.create("u1", {
      ...activity("2026-11-03", "Three"),
      tags: ["bug", "api"],
      project: "B",
    });
    await repository.create("u2", {
      ...activity("2026-11-02", "Other"),
      tags: ["private", "api"],
      project: "Secret",
    });

    await expect(repository.meta("u1")).resolves.toEqual({
      projects: ["A", "B"],
      tags: ["api", "bug"],
    });
  });
});

function activity(date: string, title: string) {
  return {
    date,
    title,
    tags: [],
    referenceUrls: [],
    project: null,
  };
}
