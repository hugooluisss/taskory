import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "./mysql-test-database";
import { configureHttp } from "../src/http-setup";
import { User } from "../src/users/entities/user.entity";
import { ApiKey } from "../src/api-keys/entities/api-key.entity";
import { authRateLimit } from "../src/auth/auth.constants";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";

interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  language: "es" | "en";
}

interface AuthResponse {
  token: string;
  user: RegisteredUser;
}

interface ApiKeyResponse {
  id: string;
  name: string;
  key: string;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("User registration", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Successful registration", async () => {
    const response = await register(app, "new@example.com", "New User").expect(
      201,
    );
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: "new@example.com",
      name: "New User",
      language: "en",
    });
  });

  it("Duplicate email", async () => {
    await register(app, "duplicate@example.com", "First").expect(201);
    const response = await register(
      app,
      "duplicate@example.com",
      "Second",
    ).expect(409);
    expect(response.body).toMatchObject({
      statusCode: 409,
      code: "EMAIL_TAKEN",
    });
  });

  it("Weak password", async () => {
    const response = await register(
      app,
      "weak@example.com",
      "Weak",
      "short",
    ).expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });
});

describe("Input length limits", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "length@example.com", "Length User"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Oversized name", async () => {
    const response = await register(
      app,
      "oversized@example.com",
      "x".repeat(101),
    ).expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("Oversized name", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/v1/auth/me")
      .set(bearer(user.token))
      .send({ name: "x".repeat(101) })
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("Oversized name", async () => {
    const response = await createKey(app, user.token, "x".repeat(101)).expect(
      400,
    );
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("Password security", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Profile never exposes secrets", async () => {
    const registration = await register(
      app,
      "secrets@example.com",
      "Secrets",
    ).expect(201);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "secrets@example.com", password: "password-123" })
      .expect(200);
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(registration.body.token))
      .expect(200);

    for (const body of [registration.body.user, login.body.user, me.body]) {
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(body)).not.toContain("password-123");
    }
  });

  it("Database leak", async () => {
    const response = await register(app, "hashed@example.com", "Hashed").expect(
      201,
    );
    const dataSource = app.get(DataSource);
    const stored = await dataSource.getRepository(User).findOne({
      where: { email: "hashed@example.com" },
      select: { id: true, passwordHash: true },
    });
    expect(stored?.passwordHash).not.toBe("password-123");
    expect(stored?.passwordHash).toMatch(/^\$2/);
    expect(JSON.stringify(response.body)).not.toContain(stored?.passwordHash);
  });
});

describe("User login", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "login@example.com", "Login User"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Valid credentials", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: user.user.email, password: "password-123" })
      .expect(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toEqual(user.user);
  });

  it("Invalid credentials", async () => {
    const unknown = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "unknown@example.com", password: "password-123" })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: user.user.email, password: "wrong-password" })
      .expect(401);
    expect(unknown.body.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.body.message).toBe(wrong.body.message);
  });
});

describe("Authenticated profile", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "profile@example.com", "Profile User"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Read profile", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(user.token))
      .expect(200);
    expect(response.body).toEqual(user.user);
  });

  it("Missing or invalid token", async () => {
    const missing = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .expect(401);
    const invalid = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer("invalid"))
      .expect(401);
    expect(missing.body.code).toBe("UNAUTHORIZED");
    expect(invalid.body.code).toBe("UNAUTHORIZED");
  });

  it("Profile update", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/v1/auth/me")
      .set(bearer(user.token))
      .send({ name: "Updated", language: "es" })
      .expect(200);
    expect(response.body).toMatchObject({
      id: user.user.id,
      name: "Updated",
      language: "es",
    });
  });

  it("Unsupported language", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/v1/auth/me")
      .set(bearer(user.token))
      .send({ language: "fr" })
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("Authentication rate limiting", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Too many attempts", async () => {
    const responses = [];
    for (let attempt = 0; attempt < authRateLimit() + 1; attempt += 1) {
      responses.push(
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email: "limit@example.com", password: "password-123" }),
      );
    }
    const limited = responses.find((response) => response.status === 429);
    expect(limited?.body).toMatchObject({
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("Only auth routes are throttled", async () => {
    for (let attempt = 0; attempt < authRateLimit() + 1; attempt += 1) {
      await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    }
  });
});

describe("Health check", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Service up", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200, { status: "ok" });
  });
});

describe("API key creation", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "key-create@example.com", "Key User"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Create key", async () => {
    const response = await createKey(app, user.token, "MCP").expect(201);
    expect(response.body.key).toMatch(/^tk_/);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: "MCP",
    });
  });

  it("Key is never shown again", async () => {
    const created = await createKey(app, user.token, "List key").expect(201);
    const list = await request(app.getHttpServer())
      .get("/api/v1/api-keys")
      .set(bearer(user.token))
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    const listed = list.body.find(
      (item: { id: string }) => item.id === created.body.id,
    );
    expect(listed).toMatchObject({
      id: created.body.id,
      name: "List key",
      prefix: expect.any(String),
    });
    expect(listed).toHaveProperty("createdAt");
    expect(listed).toHaveProperty("lastUsedAt");
    expect(JSON.stringify(list.body)).not.toContain(created.body.key);
  });

  it("Database leak", async () => {
    const created = await createKey(app, user.token, "Stored hash").expect(201);
    const dataSource = app.get(DataSource);
    const stored = await dataSource
      .getRepository(ApiKey)
      .findOne({ where: { id: created.body.id } });
    expect(stored?.keyHash).toBeTruthy();
    expect(stored?.keyHash).not.toBe(created.body.key);
    expect(JSON.stringify(stored)).not.toContain(created.body.key);
  });
});

describe("API key limit", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "key-limit@example.com", "Key Limit"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Limit reached", async () => {
    for (let index = 0; index < 20; index += 1) {
      await createKey(app, user.token, `Key ${index}`).expect(201);
    }
    const response = await createKey(app, user.token, "Key 21").expect(409);
    expect(response.body.code).toBe("API_KEY_LIMIT");
    expect(response.body.message).toMatch(/limit/i);
    const spanish = await createKey(app, user.token, "Key 22")
      .set("Accept-Language", "es")
      .expect(409);
    expect(spanish.body.code).toBe("API_KEY_LIMIT");
    expect(spanish.body.message).toMatch(/límite/i);
  });

  it("Revoking frees a slot", async () => {
    const keys: ApiKeyResponse[] = [];
    for (let index = 0; index < 20; index += 1) {
      const response = await createKey(app, user.token, `Key ${index}`).expect(
        201,
      );
      keys.push(response.body as ApiKeyResponse);
    }
    await request(app.getHttpServer())
      .delete(`/api/v1/api-keys/${keys[0].id}`)
      .set(bearer(user.token))
      .expect(204);
    await createKey(app, user.token, "Replacement").expect(201);
  });
});

describe("API key authentication", () => {
  let app: INestApplication;
  let databasePath: string;
  let user: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    user = (await register(app, "key-auth@example.com", "Key Owner"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Request with a valid key", async () => {
    const key = await createKey(app, user.token, "Auth key").expect(201);
    const profile = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(key.body.key))
      .expect(200);
    expect(profile.body).toEqual(user.user);
    const list = await request(app.getHttpServer())
      .get("/api/v1/api-keys")
      .set(bearer(user.token))
      .expect(200);
    expect(
      list.body.find((item: { id: string }) => item.id === key.body.id)
        .lastUsedAt,
    ).toBeTruthy();
  });

  it("Revoked key", async () => {
    const key = await createKey(app, user.token, "Revoked key").expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/api-keys/${key.body.id}`)
      .set(bearer(user.token))
      .expect(204);
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(key.body.key))
      .expect(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});

describe("API key revocation and ownership", () => {
  let app: INestApplication;
  let databasePath: string;
  let owner: AuthResponse;
  let other: AuthResponse;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    owner = (await register(app, "owner@example.com", "Owner"))
      .body as AuthResponse;
    other = (await register(app, "other@example.com", "Other"))
      .body as AuthResponse;
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Revoke own key", async () => {
    const key = await createKey(app, owner.token, "Owned key").expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/api-keys/${key.body.id}`)
      .set(bearer(owner.token))
      .expect(204);
  });

  it("Another user's key", async () => {
    const key = await createKey(app, owner.token, "Foreign key").expect(201);
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/api-keys/${key.body.id}`)
      .set(bearer(other.token))
      .expect(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });
});

describe("Uniform error format", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Validation failure", async () => {
    const response = await register(app, "invalid-format", "Invalid").expect(
      400,
    );
    expect(response.body).toEqual({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: expect.any(String),
    });
  });
});

describe("Localized messages", () => {
  let app: INestApplication;
  let databasePath: string;

  beforeEach(async () => {
    ({ app, databasePath } = await createApp());
    await register(app, "duplicate@example.com", "First").expect(201);
  });

  afterEach(async () => {
    await app.close();
    await removeDatabase(databasePath);
  });

  it("Spanish client", async () => {
    const response = await register(app, "duplicate@example.com", "Second")
      .set("Accept-Language", "es")
      .expect(409);
    expect(response.body.code).toBe("EMAIL_TAKEN");
    expect(response.body.message).toMatch(/correo/i);
  });

  it("Unsupported language", async () => {
    const response = await register(app, "duplicate@example.com", "Third")
      .set("Accept-Language", "fr")
      .expect(409);
    expect(response.body.code).toBe("EMAIL_TAKEN");
    expect(response.body.message).toBe("Email is already registered");
  });
});

async function createApp(): Promise<{
  app: INestApplication;
  databasePath: string;
}> {
  process.env.JWT_SECRET = "e2e-secret";
  const database = await createMySqlTestDatabase();
  const databasePath = database.options.database as string;
  await database.destroy();
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(REPORT_GENERATOR)
    .useValue({
      generate: async () => ({
        markdown: "",
        provider: "",
        model: "",
        totalTokens: 0,
      }),
    })
    .compile();
  const app = module.createNestApplication();
  configureHttp(app);
  await app.init();
  return { app, databasePath };
}

async function removeDatabase(name: string): Promise<void> {
  await dropMySqlTestDatabase(name);
}

function register(
  app: INestApplication,
  email: string,
  name: string,
  password = "password-123",
) {
  return request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, name, password });
}

function createKey(app: INestApplication, token: string, name: string) {
  return request(app.getHttpServer())
    .post("/api/v1/api-keys")
    .set(bearer(token))
    .send({ name });
}
