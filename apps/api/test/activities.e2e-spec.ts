import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { Activity } from "../src/activities/entities/activity.entity";
import { ACTIVITY_CLOCK } from "../src/activities/activities.service";
import { configureHttp } from "../src/http-setup";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";

describe("Activity creation", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Minimal activity", async () => {
    const response = await create(app, owner, {
      date: "2026-11-16",
      title: "Work",
    }).expect(201);
    expect(response.body).toMatchObject({
      referenceUrls: [],
      tags: [],
      description: null,
      project: null,
    });
  });

  it("Multiple reference URLs", async () => {
    const urls = ["https://one.example", "http://two.example/path"];
    const response = await create(app, owner, {
      date: "2026-11-16",
      title: "Links",
      referenceUrls: urls,
    }).expect(201);
    expect(response.body.referenceUrls).toEqual(urls);
  });

  it("Missing required field", async () => {
    const invalidBodies = [
      { title: "No date" },
      { date: "2026-11-16" },
      { date: "2026-02-30", title: "Bad date" },
      { date: "2026-11-16", title: "" },
    ];
    for (const body of invalidBodies) {
      const response = await create(app, owner, body).expect(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Invalid URL", async () => {
    const response = await create(app, owner, {
      date: "2026-11-16",
      title: "Bad URL",
      referenceUrls: ["javascript:alert(1)"],
    }).expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("Protected fields are ignored", async () => {
    const response = await create(app, owner, {
      date: "2026-11-16",
      title: "Protected",
      id: "forged-post-id",
      userId: "foreign-user",
      createdAt: "2000-01-01T00:00:00Z",
      updatedAt: "2000-01-01T00:00:00Z",
    }).expect(201);
    const stored = await request(app.getHttpServer())
      .get(`/api/v1/activities/${response.body.id}`)
      .set(auth(owner))
      .expect(200);

    expect(response.body.id).not.toBe("forged-post-id");
    expect(stored.body.id).toBe(response.body.id);
    expect(stored.body).not.toHaveProperty("userId");
    const persisted = await app
      .get(DataSource)
      .getRepository(Activity)
      .findOneByOrFail({ id: response.body.id });
    expect(persisted.userId).toBeTruthy();
    expect(persisted.userId).not.toBe("foreign-user");
    expect(stored.body.createdAt).toBe(response.body.createdAt);
    expect(stored.body.updatedAt).toBe(response.body.updatedAt);
    expect(response.body).not.toHaveProperty("userId");
    expect(new Date(response.body.createdAt).getUTCFullYear()).not.toBe(2000);
    expect(new Date(response.body.updatedAt).getUTCFullYear()).not.toBe(2000);
  });
});

describe("Tag normalization", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Duplicate tags", async () => {
    const response = await create(app, owner, {
      date: "2026-11-16",
      title: "Tags",
      tags: ["API", "api ", "Bug"],
    }).expect(201);
    expect(response.body.tags).toEqual(["api", "bug"]);
  });
});

describe("Activity listing and filters", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;
  let other: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
    other = await register(app, "other");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Date range", async () => {
    await create(app, owner, { date: "2026-10-31", title: "Before" });
    await create(app, owner, { date: "2026-11-01", title: "Start" });
    await create(app, owner, { date: "2026-11-15", title: "End" });
    await create(app, owner, { date: "2026-11-16", title: "After" });
    await create(app, other, { date: "2026-11-05", title: "Foreign" });
    const response = await list(
      app,
      owner,
      "from=2026-11-01&to=2026-11-15",
    ).expect(200);
    expect(response.body.items[0]).not.toHaveProperty("userId");
    const titles = response.body.items.map(
      (item: { title: string }) => item.title,
    );
    expect(titles.sort()).toEqual(["End", "Start"]);
  });

  it("Text search", async () => {
    const match = await create(app, owner, {
      date: "2026-11-16",
      title: "Other title",
      description: "login happened",
    });
    await create(app, owner, { date: "2026-11-16", title: "unrelated" });
    const response = await list(app, owner, "q=login").expect(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      match.body.id,
    ]);
  });

  it("Limit above cap", async () => {
    const response = await list(app, owner, "limit=1000").expect(200);
    expect(response.body.limit).toBe(200);
  });

  it("Non-numeric pagination", async () => {
    const response = await list(app, owner, "page=abc").expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("Zero pagination is normalized", async () => {
    const response = await list(app, owner, "page=0&limit=0").expect(200);
    expect(response.body).toMatchObject({ page: 1, limit: 50 });
  });
});

describe("Filter and body validation", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Invalid filter date", async () => {
    for (const query of [
      "from=2026-02-30",
      "to=2026-02-30",
      "from=0000-01-01",
    ]) {
      const response = await list(app, owner, query).expect(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Reversed date range", async () => {
    const response = await list(
      app,
      owner,
      "from=2026-11-16&to=2026-11-01",
    ).expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("Empty update", async () => {
    const created = await create(app, owner, {
      date: "2026-11-16",
      title: "Keep",
    });
    const updatedAt = created.body.updatedAt;
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .send({})
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    const current = await request(app.getHttpServer())
      .get(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .expect(200);
    expect(current.body.updatedAt).toBe(updatedAt);
  });

  it("Oversized body", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/activities")
      .set(auth(owner))
      .set("Accept-Language", "es")
      .send({
        date: "2026-11-16",
        title: "Large",
        description: "x".repeat(2 * 1024 * 1024),
      })
      .expect(413);
    expect(response.body).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      message: expect.stringMatching(/demasiado grande/i),
    });
  });

  it("Protected fields are ignored", async () => {
    const created = await create(app, owner, {
      date: "2026-11-16",
      title: "Original",
    });
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .send({
        title: "Updated",
        id: "forged-patch-id",
        userId: "other",
        createdAt: "2000-01-01",
        updatedAt: "2000-01-01",
      })
      .expect(200);
    const stored = await request(app.getHttpServer())
      .get(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .expect(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.title).toBe("Updated");
    expect(response.body.createdAt).toBe(created.body.createdAt);
    expect(response.body.updatedAt).not.toBe("2000-01-01");
    expect(stored.body.id).toBe(created.body.id);
    expect(response.body).not.toHaveProperty("userId");
    expect(stored.body).not.toHaveProperty("userId");
    const persisted = await app
      .get(DataSource)
      .getRepository(Activity)
      .findOneByOrFail({ id: created.body.id });
    expect(persisted.userId).not.toBe("other");
    expect(stored.body.createdAt).toBe(created.body.createdAt);
    expect(stored.body.updatedAt).toBe(response.body.updatedAt);
    expect(stored.body.updatedAt).not.toBe("2000-01-01");
  });
});

describe("Activity read, update and delete", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;
  let other: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
    other = await register(app, "other");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Partial update", async () => {
    const created = await create(app, owner, {
      date: "2026-11-16",
      title: "Old",
      tags: ["API"],
      project: "A",
    });
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .send({ title: "New" })
      .expect(200);
    expect(updated.body).toMatchObject({
      title: "New",
      date: "2026-11-16",
      tags: ["api"],
      project: "A",
    });
    expect(updated.body.updatedAt).toBe("2099-01-01T00:00:00.000Z");
    expect(updated.body.updatedAt).not.toBe(created.body.updatedAt);
  });

  it("Delete", async () => {
    const created = await create(app, owner, {
      date: "2026-11-16",
      title: "Delete me",
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .expect(204);
    const missing = await request(app.getHttpServer())
      .get(`/api/v1/activities/${created.body.id}`)
      .set(auth(owner))
      .expect(404);
    expect(missing.body.code).toBe("NOT_FOUND");
  });
});

describe("Per-user isolation", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;
  let other: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
    other = await register(app, "other");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Listing never leaks", async () => {
    const owned = await create(app, owner, {
      date: "2026-11-16",
      title: "Mine",
    });
    await create(app, other, { date: "2026-11-16", title: "Theirs" });
    const response = await list(app, owner, "").expect(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      owned.body.id,
    ]);
  });

  it("Foreign activity", async () => {
    const created = await create(app, owner, {
      date: "2026-11-16",
      title: "Private",
    });
    const get = await request(app.getHttpServer())
      .get(`/api/v1/activities/${created.body.id}`)
      .set(auth(other))
      .expect(404);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/activities/${created.body.id}`)
      .set(auth(other))
      .send({ title: "Changed" })
      .expect(404);
    const deletion = await request(app.getHttpServer())
      .delete(`/api/v1/activities/${created.body.id}`)
      .set(auth(other))
      .expect(404);

    for (const response of [get, patch, deletion]) {
      expect(response.body.code).toBe("NOT_FOUND");
    }
  });
});

describe("Activity metadata", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: string;
  let other: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = await register(app, "owner");
    other = await register(app, "other");
  });

  afterEach(async () => closeApp(app, databasePath));

  it("Suggestions", async () => {
    await create(app, owner, {
      date: "2026-11-16",
      title: "A",
      project: "A",
      tags: ["mine"],
    });
    await create(app, owner, {
      date: "2026-11-17",
      title: "B",
      project: "B",
      tags: ["mine"],
    });
    await create(app, other, {
      date: "2026-11-16",
      title: "Secret",
      project: "Secret",
      tags: ["secret"],
    });
    await request(app.getHttpServer())
      .get("/api/v1/activities/meta")
      .set(auth(owner))
      .expect(200, { projects: ["A", "B"], tags: ["mine"] });
    await request(app.getHttpServer())
      .get("/api/v1/activities/meta")
      .set(auth(other))
      .expect(200, { projects: ["Secret"], tags: ["secret"] });
  });
});

async function createApp(): Promise<{
  app: INestApplication;
  databasePath: string;
}> {
  process.env.JWT_SECRET = "e2e-secret";
  const databasePath = join(
    tmpdir(),
    `taskory-activities-${randomUUID()}.sqlite`,
  );
  process.env.DATABASE_PATH = databasePath;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REPORT_GENERATOR)
    .useValue({
      listProviders: async () => [],
      generate: async () => ({ markdown: "", provider: "", model: "" }),
    })
    .overrideProvider(ACTIVITY_CLOCK)
    .useValue(() => new Date("2099-01-01T00:00:00.000Z"))
    .compile();
  const app = module.createNestApplication();
  configureHttp(app);
  await app.init();
  return { app, databasePath };
}

async function closeApp(
  app: INestApplication,
  databasePath: string,
): Promise<void> {
  await app.close();
  await unlink(databasePath).catch(() => undefined);
  await unlink(`${databasePath}-shm`).catch(() => undefined);
  await unlink(`${databasePath}-wal`).catch(() => undefined);
}

async function register(app: INestApplication, name: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({
      email: `${name}-${randomUUID()}@example.com`,
      name,
      password: "password-123",
    });
  return response.body.token as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function create(app: INestApplication, token: string, body: object) {
  return request(app.getHttpServer())
    .post("/api/v1/activities")
    .set(auth(token))
    .send(body);
}

function list(app: INestApplication, token: string, query: string) {
  return request(app.getHttpServer())
    .get(`/api/v1/activities?${query}`)
    .set(auth(token));
}
