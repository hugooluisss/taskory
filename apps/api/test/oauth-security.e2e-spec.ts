import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureHttp } from "../src/http-setup";
import { OAuthAuthorization } from "../src/oauth/entities/oauth-authorization.entity";
import { OAuthToken } from "../src/oauth/entities/oauth-token.entity";
import { OAuthAuthorizationRequest } from "../src/oauth/entities/oauth-authorization-request.entity";
import { OAUTH_NOW } from "../src/oauth/oauth-clock";
import { OAuthTokensRepository } from "../src/oauth/oauth-tokens.repository";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";

const REDIRECT_URI = "http://localhost:8787/callback";

describe("OAuth security probe scenarios", () => {
  let app: INestApplication;
  let databasePath: string;
  let currentTime: Date;
  let userToken: string;

  beforeEach(async () => {
    process.env.JWT_SECRET = "oauth-security-e2e-secret";
    delete process.env.OAUTH_RATE_LIMIT;
    delete process.env.OAUTH_RATE_WINDOW_MS;
    currentTime = new Date("2026-02-03T04:05:06.000Z");
    databasePath = join(
      tmpdir(),
      `taskory-oauth-security-${randomUUID()}.sqlite`,
    );
    process.env.DATABASE_PATH = databasePath;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(REPORT_GENERATOR)
      .useValue({
        listProviders: async () => [],
        generate: async () => ({ markdown: "", provider: "", model: "" }),
      })
      .overrideProvider(OAUTH_NOW)
      .useValue(() => new Date(currentTime))
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
    userToken = await registerUser();
  });

  afterEach(async () => {
    await app.close();
    await unlink(databasePath).catch(() => undefined);
    await unlink(`${databasePath}-shm`).catch(() => undefined);
    await unlink(`${databasePath}-wal`).catch(() => undefined);
  });

  describe("Dynamic registration redirect validation", () => {
    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "file:///etc/passwd",
      "http://evil.com/cb",
      "http://localhost.evil.com/cb",
      "http://127.0.0.1.evil.com/cb",
      "http://[::1]@evil.com/cb",
      "https://good.com@evil.com/cb",
      "https://x.com/cb#frag",
      "https://*.x.com/cb",
      "https://user:pw@x.com/cb",
      "http://0.0.0.0/cb",
      "http://2130706433/cb",
      "http://0x7f.1/cb",
      "http://127.1/cb",
      "https://x.com/cb\r\nX: y",
      "https://x.com/cb\tz",
      "https:///cb",
      `https://${"a".repeat(2100)}.com/cb`,
      "java\tscript:alert(1)",
      "abc:def",
    ])("Rejects hostile URI %p", async (uri) => {
      await request(app.getHttpServer())
        .post("/oauth/register")
        .send({ client_name: "Hostile", redirect_uris: [uri] })
        .expect(400);
    });

    it.each([
      "https://app.example.com/cb",
      "http://localhost:8787/callback",
      "http://127.0.0.1:9/cb",
      "http://[::1]:1/cb",
      "cursor://anysphere.cursor-mcp/oauth/callback",
    ])("Accepts supported URI %s", async (uri) => {
      await request(app.getHttpServer())
        .post("/oauth/register")
        .send({ client_name: "Supported", redirect_uris: [uri] })
        .expect(201);
    });
  });

  describe("Exact registered redirect matching", () => {
    it.each([
      "https://a.example.com/cb/",
      "HTTPS://A.EXAMPLE.COM/cb",
      "https://a.example.com/cb?x=1",
      "https://a.example.com:443/cb",
      "https://a.example.com/CB",
    ])("Rejects redirect variant %s without Location", async (redirectUri) => {
      const response = await request(app.getHttpServer())
        .post("/oauth/register")
        .send({
          client_name: "Exact",
          redirect_uris: ["https://a.example.com/cb"],
        })
        .expect(201);
      const verifier = randomVerifier();
      const result = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: response.body.client_id,
          redirect_uri: redirectUri,
          code_challenge: sha256(verifier),
          code_challenge_method: "S256",
        })
        .expect(400);
      expect(result.headers.location).toBeUndefined();
    });
  });

  describe("Authorization error state encoding", () => {
    it("Keeps CRLF and parameter syntax inside one encoded state", async () => {
      const clientId = await registerClient();
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "token",
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          state: "a&error=x#frag\r\nX-Evil: 1",
        })
        .redirects(0)
        .expect(302);
      const location = new URL(response.headers.location);
      expect(location.searchParams.get("state")).toBe(
        "a&error=x#frag\r\nX-Evil: 1",
      );
      expect(location.searchParams.getAll("error")).toHaveLength(1);
      expect(response.headers.location).not.toMatch(/[\r\n]/);
    });
  });

  describe("PKCE validation", () => {
    it.each([
      ["missing challenge", undefined, "S256"],
      ["plain", "a".repeat(43), "plain"],
      ["short", "abc", "S256"],
      ["bad characters", "!".repeat(43), "S256"],
    ])(
      "Rejects %s without creating consent",
      async (_scenario, challenge, method) => {
        const clientId = await registerClient();
        const query: Record<string, string> = {
          response_type: "code",
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
          code_challenge_method: method,
        };
        if (challenge !== undefined) query.code_challenge = challenge;
        const response = await request(app.getHttpServer())
          .get("/oauth/authorize")
          .query(query)
          .redirects(0)
          .expect(302);
        expect(
          new URL(response.headers.location).searchParams.get("error"),
        ).toBe("invalid_request");
        expect(response.headers.location).not.toContain("/oauth/consent");
      },
    );
  });

  describe("Consent identity and strict decisions", () => {
    it("Rejects API keys, OAuth tokens, missing auth, and malformed approve values without consuming the request", async () => {
      const grant = await prepareGrant();
      const issued = await exchange(grant).expect(200);
      const apiKey = await request(app.getHttpServer())
        .post("/api/v1/api-keys")
        .set(bearer(userToken))
        .send({ name: "security" })
        .expect(201);
      const clientId = await registerClient();
      const requestId = await startAuthorization(
        clientId,
        sha256(randomVerifier()),
      );
      const decisionPath = `/api/v1/oauth/requests/${requestId}/decision`;
      await request(app.getHttpServer())
        .post(decisionPath)
        .set(bearer(issued.body.access_token))
        .send({ approve: true })
        .expect(401);
      await request(app.getHttpServer())
        .post(decisionPath)
        .set(bearer(apiKey.body.key))
        .send({ approve: true })
        .expect(401);
      await request(app.getHttpServer())
        .post(decisionPath)
        .send({ approve: true })
        .expect(401);
      for (const approve of ["true"]) {
        await request(app.getHttpServer())
          .post(decisionPath)
          .set(bearer(userToken))
          .send({ approve })
          .expect(400);
      }
      await request(app.getHttpServer())
        .get(`/api/v1/oauth/requests/${requestId}`)
        .set(bearer(userToken))
        .expect(200);
    });
  });

  describe("OAuth parameter pollution and CORS", () => {
    it("Rejects repeated form fields, prototype JSON, and text bodies with 4xx", async () => {
      await request(app.getHttpServer())
        .post("/oauth/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("grant_type=authorization_code&code=a&code=b")
        .expect(400);
      await request(app.getHttpServer())
        .post("/oauth/token")
        .set("Content-Type", "application/json")
        .send('{"__proto__":{"x":1},"grant_type":["authorization_code"]}')
        .expect(400);
      await request(app.getHttpServer())
        .post("/oauth/token")
        .set("Content-Type", "text/plain")
        .send("grant_type=refresh_token")
        .expect(400);
    });

    it("Scopes wildcard CORS to metadata and omits it on API and authorize", async () => {
      const metadata = await request(app.getHttpServer())
        .get("/.well-known/oauth-authorization-server")
        .set("Origin", "https://evil.example")
        .expect(200);
      expect(metadata.headers["access-control-allow-origin"]).toBe("*");
      expect(
        metadata.headers["access-control-allow-credentials"],
      ).toBeUndefined();
      const apiResponse = await request(app.getHttpServer())
        .get("/api/v1/activities")
        .set("Origin", "https://evil.example")
        .set(bearer(userToken))
        .expect(200);
      expect(
        apiResponse.headers["access-control-allow-origin"],
      ).toBeUndefined();
      const authorizeResponse = await request(app.getHttpServer())
        .get("/oauth/authorize?x=1")
        .set("Origin", "https://evil.example")
        .expect(400);
      expect(
        authorizeResponse.headers["access-control-allow-origin"],
      ).toBeUndefined();
    });
  });

  describe("Concurrent authorization code exchange", () => {
    it("Issues one token pair from 50 requests and revokes it after replay", async () => {
      const grant = await prepareGrant();
      const responses = await Promise.all(
        Array.from({ length: 50 }, () => exchange(grant)),
      );
      const successful = responses.filter(
        (response) => response.status === 200,
      );
      expect(successful).toHaveLength(1);
      const rows = await app.get(DataSource).getRepository(OAuthToken).find();
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(successful[0].body.access_token))
        .expect(401);
    });
  });

  describe("Concurrent refresh rotation", () => {
    it("Allows exactly one refresh and revokes the grant after losing replays", async () => {
      const grant = await prepareGrant();
      const issued = await exchange(grant).expect(200);
      const responses = await Promise.all(
        Array.from({ length: 30 }, () =>
          request(app.getHttpServer())
            .post("/oauth/token")
            .send({
              grant_type: "refresh_token",
              refresh_token: issued.body.refresh_token,
              client_id: grant.clientId,
            }),
        ),
      );
      expect(
        responses.filter((response) => response.status === 200),
      ).toHaveLength(1);
      expect(
        responses.filter((response) => response.status === 400),
      ).toHaveLength(29);
      const rows = await app.get(DataSource).getRepository(OAuthToken).find();
      expect(rows).toHaveLength(4);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(
          bearer(
            responses.find((response) => response.status === 200)!.body
              .access_token,
          ),
        )
        .expect(401);
    });
  });

  describe("Concurrent consent decisions", () => {
    it("Approves 20 different requests concurrently", async () => {
      const clientId = await registerClient();
      const requestIds = await Promise.all(
        Array.from({ length: 20 }, async () =>
          startAuthorization(clientId, sha256(randomVerifier())),
        ),
      );
      const responses = await Promise.all(
        requestIds.map((requestId) =>
          request(app.getHttpServer())
            .post(`/api/v1/oauth/requests/${requestId}/decision`)
            .set(bearer(userToken))
            .send({ approve: true }),
        ),
      );
      expect(responses.every((response) => response.status === 201)).toBe(true);
      expect(
        await app.get(DataSource).getRepository(OAuthAuthorization).count(),
      ).toBe(20);
    });

    it("Issues exactly one code from 20 decisions", async () => {
      const clientId = await registerClient();
      const verifier = randomVerifier();
      const requestId = await startAuthorization(clientId, sha256(verifier));
      const responses = await Promise.all(
        Array.from({ length: 20 }, () =>
          request(app.getHttpServer())
            .post(`/api/v1/oauth/requests/${requestId}/decision`)
            .set(bearer(userToken))
            .send({ approve: true }),
        ),
      );
      expect(
        responses.filter((response) => [200, 201].includes(response.status)),
      ).toHaveLength(1);
    });
  });

  describe("Authorization replay evidence retention", () => {
    it("Retains live rotated refresh and used code evidence through purge", async () => {
      const grant = await prepareGrant();
      const original = await exchange(grant).expect(200);
      const rotated = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: original.body.refresh_token,
          client_id: grant.clientId,
        })
        .expect(200);
      currentTime = new Date(currentTime.getTime() + 31 * 24 * 60 * 60 * 1000);
      const now = new Date(currentTime);
      await app
        .get(OAuthTokensRepository)
        .purgeExpired(
          now,
          new Date(now.getTime() - 7 * 86400000),
          new Date(now.getTime() - 30 * 86400000),
        );
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: original.body.refresh_token,
          client_id: grant.clientId,
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(rotated.body.access_token))
        .expect(401);
    });

    it("Purges genuinely expired code evidence before a separate code replay", async () => {
      const grant = await prepareGrant();
      await exchange(grant).expect(200);
      currentTime = new Date(currentTime.getTime() + 181 * 24 * 60 * 60 * 1000);
      const now = new Date(currentTime);
      await app
        .get(OAuthTokensRepository)
        .purgeExpired(
          now,
          new Date(now.getTime() - 7 * 86400000),
          new Date(now.getTime() - 30 * 86400000),
        );
      const codes = await app
        .get(DataSource)
        .query("SELECT * FROM oauth_authorization_codes");
      expect(codes).toHaveLength(0);
      await exchange(grant)
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });

    it("Purges genuinely expired refresh evidence before a separate refresh replay", async () => {
      const grant = await prepareGrant();
      const initial = await exchange(grant).expect(200);
      currentTime = new Date(currentTime.getTime() + 181 * 24 * 60 * 60 * 1000);
      const now = new Date(currentTime);
      await app
        .get(OAuthTokensRepository)
        .purgeExpired(
          now,
          new Date(now.getTime() - 7 * 86400000),
          new Date(now.getTime() - 30 * 86400000),
        );
      expect(await app.get(DataSource).getRepository(OAuthToken).count()).toBe(
        0,
      );
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: initial.body.refresh_token,
          client_id: grant.clientId,
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });
  });

  describe("Resource audience enforcement", () => {
    it("Rejects an API access token whose authorization names another resource", async () => {
      const grant = await prepareGrant();
      const issued = await exchange(grant).expect(200);
      await app
        .get(DataSource)
        .getRepository(OAuthAuthorization)
        .update(
          { clientId: grant.clientId },
          { resource: "https://other.example/mcp" },
        );
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(issued.body.access_token))
        .expect(401);
    });
  });

  describe("Concurrent exchange revocation", () => {
    it("Revokes refresh tokens when a concurrent exchange replays the same code", async () => {
      const grant = await prepareGrant();
      const initial = await exchange(grant).expect(200);
      const replay = await exchange(grant);
      expect(replay.status).toBe(400);
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: initial.body.refresh_token,
          client_id: grant.clientId,
        })
        .expect(400);
    });
  });

  async function registerUser(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `security-${randomUUID()}@example.com`,
        name: "Security",
        password: "password123",
      })
      .expect(201);
    return response.body.token;
  }

  async function registerClient(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/oauth/register")
      .send({
        client_name: "Security client",
        redirect_uris: [REDIRECT_URI],
      })
      .expect(201);
    return response.body.client_id;
  }

  async function startAuthorization(
    clientId: string,
    challenge: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/oauth/authorize")
      .query({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "security-state",
      })
      .redirects(0)
      .expect(302);
    return new URL(response.headers.location).searchParams.get("request")!;
  }

  async function prepareGrant(): Promise<{
    clientId: string;
    code: string;
    verifier: string;
  }> {
    const clientId = await registerClient();
    const verifier = randomVerifier();
    const requestId = await startAuthorization(clientId, sha256(verifier));
    const decision = await request(app.getHttpServer())
      .post(`/api/v1/oauth/requests/${requestId}/decision`)
      .set(bearer(userToken))
      .send({ approve: true })
      .expect(201);
    return {
      clientId,
      code: new URL(decision.body.redirectUrl).searchParams.get("code")!,
      verifier,
    };
  }

  function exchange(grant: {
    clientId: string;
    code: string;
    verifier: string;
  }) {
    return request(app.getHttpServer()).post("/oauth/token").send({
      grant_type: "authorization_code",
      code: grant.code,
      code_verifier: grant.verifier,
      client_id: grant.clientId,
      redirect_uri: REDIRECT_URI,
    });
  }
});

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function randomVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
