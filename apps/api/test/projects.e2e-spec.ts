import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureHttp } from "../src/http-setup";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "./mysql-test-database";

describe("Project management", () => {
  let app: INestApplication;
  let database: string;
  let token: string;

  beforeEach(async () => {
    const source = await createMySqlTestDatabase();
    database = source.options.database as string;
    await source.destroy();
    process.env.JWT_SECRET = "project-test-secret";
    app = await Test.createTestingModule({ imports: [AppModule] })
      .compile()
      .then((module) => module.createNestApplication());
    configureHttp(app);
    await app.init();
    const auth = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "projects@example.test",
        password: "password123",
        name: "Projects",
      })
      .expect(201);
    token = auth.body.token;
  });

  afterEach(async () => {
    await app?.close();
    if (database) await dropMySqlTestDatabase(database);
  });

  it("Creates and lists a trimmed project", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: " Alpha " })
      .expect(201);
    expect(created.body).toMatchObject({ name: "Alpha", archived: false });
    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .expect(200, [created.body]);
  });

  describe("Project description", () => {
    it("Save description", async () => {
      const headers = { Authorization: `Bearer ${token}` };
      const created = await request(app.getHttpServer())
        .post("/api/v1/projects")
        .set(headers)
        .send({ name: "Described", description: "  Internal tools  " })
        .expect(201);
      expect(created.body.description).toBe("Internal tools");
      await request(app.getHttpServer()).get("/api/v1/projects").set(headers).expect(200, [created.body]);
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${created.body.id}`)
        .set(headers)
        .send({ description: "   " })
        .expect(200)
        .expect(({ body }) => expect(body.description).toBeNull());
    });

    it("Description too long", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Too long", description: "x".repeat(1001) })
        .expect(400);
    });
  });

  it("Rejects a duplicate ignoring case", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set(auth)
      .send({ name: "SIGEI" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set(auth)
      .send({ name: "sigei" })
      .expect(409);
  });

  it("Renames and archives a project, then deletes it", async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set(headers)
      .send({ name: "Temporary" })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${created.body.id}`)
      .set(headers)
      .send({ name: "Renamed", archived: true })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ name: "Renamed", archived: true }),
      );
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${created.body.id}`)
      .set(headers)
      .expect(204);
  });

  it("Returns conflict when deleting a project with activities", async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const project = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set(headers)
      .send({ name: "Used" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/activities")
      .set(headers)
      .send({
        date: "2026-11-18",
        title: "Work",
        projectIds: [project.body.id],
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${project.body.id}`)
      .set(headers)
      .expect(409);
  });
});
