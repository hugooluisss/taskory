import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import { AppModule } from "../src/app.module";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "./mysql-test-database";
import { configureHttp } from "../src/http-setup";
import { REPORT_GENERATOR } from "../src/reports/report-generator.provider";
import { OAUTH_NOW } from "../src/oauth/oauth-clock";
import { DataSource } from "typeorm";
import { OAuthAuthorization } from "../src/oauth/entities/oauth-authorization.entity";
import { OAuthToken } from "../src/oauth/entities/oauth-token.entity";

async function provisionDatabase(): Promise<string> {
  const source = await createMySqlTestDatabase();
  const database = source.options.database as string;
  await source.destroy();
  return database;
}

const PUBLIC_URL = "http://localhost:3999";
const REDIRECT_URI = "https://client.example/callback";

describe("OAuth authorization flow", () => {
  let app: INestApplication;
  let databasePath: string;
  let currentTime: Date;

  beforeEach(async () => {
    process.env.JWT_SECRET = "oauth-e2e-secret";
    process.env.PUBLIC_URL = PUBLIC_URL;
    process.env.MCP_PATH = "/mcp";
    delete process.env.OAUTH_RATE_LIMIT;
    delete process.env.OAUTH_RATE_WINDOW_MS;
    currentTime = new Date("2026-01-02T03:04:05.000Z");
    databasePath = await provisionDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(REPORT_GENERATOR)
      .useValue({
        generate: async () => ({
          markdown: "",
          provider: "",
          model: "",
          totalTokens: 0,
        }),
      })
      .overrideProvider(OAUTH_NOW)
      .useValue(() => new Date(currentTime))
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
    activeApp = app;
  });

  afterEach(async () => {
    await app.close();
    await dropMySqlTestDatabase(databasePath);
  });

  it("Registers, consents, exchanges, refreshes, detects reuse and revokes the authorization", async () => {
    const firstUser = await registerUser("first@example.com", "First User");
    const secondUser = await registerUser("second@example.com", "Second User");
    await createActivity(firstUser.token, "first-only");
    await createActivity(secondUser.token, "second-only");
    const client = await registerClient("OAuth Client");
    const verifier = "a".repeat(43);
    const challenge = sha256(verifier);
    const state = "state-123";

    const authorization = await request(app.getHttpServer())
      .get("/oauth/authorize")
      .query({
        response_type: "code",
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      })
      .redirects(0)
      .expect(302);
    const consentUrl = new URL(authorization.headers.location);
    expect(consentUrl.origin).toBe(PUBLIC_URL);
    expect(consentUrl.pathname).toBe("/oauth/consent");
    const requestId = consentUrl.searchParams.get("request")!;

    const consent = await request(app.getHttpServer())
      .get(`/api/v1/oauth/requests/${requestId}`)
      .set(bearer(firstUser.token))
      .expect(200);
    expect(consent.body.clientName).toBe("OAuth Client");
    expect(consent.body.clientId).toBe(client.client_id);
    expect(consent.body.scope).toBe("taskory");
    expect(consent.body.accessDescription).toBe("full-access");
    expect(consent.body.redirectHost).toBe("client.example");
    expect(consent.body.redirectUri).toBe(REDIRECT_URI);
    expect(consent.body.expiresAt).toBeTruthy();
    const decision = await request(app.getHttpServer())
      .post(`/api/v1/oauth/requests/${requestId}/decision`)
      .set(bearer(firstUser.token))
      .send({ approve: true })
      .expect(201);
    const redirect = new URL(decision.body.redirectUrl);
    expect(redirect.searchParams.get("state")).toBe(state);
    const code = redirect.searchParams.get("code")!;

    const exchange = await request(app.getHttpServer())
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
      })
      .expect(200);
    expect(exchange.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
    });
    expect(exchange.body.access_token).toMatch(/^to_/);
    expect(exchange.body.refresh_token).toMatch(/^tr_/);
    expect(exchange.headers["cache-control"]).toBe("no-store");
    expect(exchange.headers.pragma).toBe("no-cache");

    const profile = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(exchange.body.access_token))
      .expect(200);
    expect(profile.body.email).toBe(firstUser.email);
    const firstActivities = await request(app.getHttpServer())
      .get("/api/v1/activities")
      .set(bearer(exchange.body.access_token))
      .expect(200);
    expect(JSON.stringify(firstActivities.body)).toContain("first-only");
    expect(JSON.stringify(firstActivities.body)).not.toContain("second-only");
    const firstApps = await request(app.getHttpServer())
      .get("/api/v1/connected-apps")
      .set(bearer(firstUser.token))
      .expect(200);
    expect(firstApps.body).toHaveLength(1);
    expect(
      (
        await request(app.getHttpServer())
          .get("/api/v1/connected-apps")
          .set(bearer(secondUser.token))
          .expect(200)
      ).body,
    ).toEqual([]);

    const refresh = await request(app.getHttpServer())
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "refresh_token",
        refresh_token: exchange.body.refresh_token,
        client_id: client.client_id,
      })
      .expect(200);
    expect(refresh.body.access_token).toMatch(/^to_/);
    expect(refresh.body.refresh_token).toMatch(/^tr_/);
    await request(app.getHttpServer())
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "refresh_token",
        refresh_token: exchange.body.refresh_token,
        client_id: client.client_id,
      })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(bearer(refresh.body.access_token))
      .expect(401);
    await request(app.getHttpServer())
      .post("/oauth/revoke")
      .send({ token: refresh.body.refresh_token })
      .expect(200)
      .expect({});
  });

  describe("OAuth discovery and client registration", () => {
    it("Publishes exact authorization server metadata", async () => {
      const response = await request(app.getHttpServer())
        .get("/.well-known/oauth-authorization-server")
        .expect(200);
      expect(response.body).toEqual({
        issuer: PUBLIC_URL,
        authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
        token_endpoint: `${PUBLIC_URL}/oauth/token`,
        registration_endpoint: `${PUBLIC_URL}/oauth/register`,
        revocation_endpoint: `${PUBLIC_URL}/oauth/revoke`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["taskory"],
        authorization_response_iss_parameter_supported: true,
      });
    });

    it("Publishes exact protected resource metadata", async () => {
      const response = await request(app.getHttpServer())
        .get("/.well-known/oauth-protected-resource")
        .expect(200);
      expect(response.body).toEqual({
        resource: `${PUBLIC_URL}/mcp`,
        authorization_servers: [PUBLIC_URL],
        bearer_methods_supported: ["header"],
      });
    });

    it("Publishes path-suffixed metadata and binds OAuth to the configured resource", async () => {
      const originalMcpPath = process.env.MCP_PATH;
      process.env.MCP_PATH = "/taskory-mcp";
      try {
        const client = await registerClient("Custom Resource");
        const metadata = await request(app.getHttpServer())
          .get("/.well-known/oauth-protected-resource/taskory-mcp")
          .expect(200);
        expect(metadata.body.resource).toBe(`${PUBLIC_URL}/taskory-mcp`);
        await request(app.getHttpServer())
          .get("/.well-known/oauth-protected-resource/mcp")
          .expect(404);

        const accepted = await request(app.getHttpServer())
          .get("/oauth/authorize")
          .query({
            response_type: "code",
            client_id: client.client_id,
            redirect_uri: REDIRECT_URI,
            code_challenge: sha256("v".repeat(43)),
            code_challenge_method: "S256",
            state: "custom-resource",
            resource: `${PUBLIC_URL}/taskory-mcp`,
          })
          .redirects(0)
          .expect(302);
        expect(new URL(accepted.headers.location).pathname).toBe(
          "/oauth/consent",
        );

        const refused = await request(app.getHttpServer())
          .get("/oauth/authorize")
          .query({
            response_type: "code",
            client_id: client.client_id,
            redirect_uri: REDIRECT_URI,
            code_challenge: sha256("w".repeat(43)),
            code_challenge_method: "S256",
            state: "wrong-resource",
            resource: `${PUBLIC_URL}/mcp`,
          })
          .redirects(0)
          .expect(302);
        expect(
          new URL(refused.headers.location).searchParams.get("error"),
        ).toBe("invalid_target");
      } finally {
        if (originalMcpPath === undefined) delete process.env.MCP_PATH;
        else process.env.MCP_PATH = originalMcpPath;
      }
    });

    it("Returns registered client data", async () => {
      const response = await request(app.getHttpServer())
        .post("/oauth/register")
        .send({ client_name: "Test Client", redirect_uris: [REDIRECT_URI] })
        .expect(201);
      expect(response.body).toEqual({
        client_id: expect.any(String),
        client_name: "Test Client",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      });
    });

    it.each([
      "https://x.com/cb\r",
      "https://x.com/cb\n",
      "https://x.com/cb\t",
      "https://x.com/cb path",
      "javascript:alert(1)",
      "data:text/plain,bad",
      "http://evil.com/cb",
      "https://x.com/cb#frag",
      "https://*.x.com/cb",
      "https://user:pw@x.com/cb",
    ])("Rejects unsafe redirect URI %s", async (uri) => {
      const response = await request(app.getHttpServer())
        .post("/oauth/register")
        .send({ client_name: "Bad Client", redirect_uris: [uri] })
        .expect(400);
      expect(response.body).toMatchObject({
        error: "invalid_redirect_uri",
        error_description: expect.any(String),
      });
    });

    it.each([
      [
        "long client name",
        { client_name: "x".repeat(101), redirect_uris: [REDIRECT_URI] },
      ],
      [
        "too many redirects",
        {
          client_name: "Client",
          redirect_uris: Array.from(
            { length: 6 },
            (_, index) => `https://client.example/${index}`,
          ),
        },
      ],
      ["empty redirects", { client_name: "Client", redirect_uris: [] }],
    ])("Rejects invalid client metadata: %s", async (_scenario, body) => {
      const response = await request(app.getHttpServer())
        .post("/oauth/register")
        .send(body)
        .expect(400);
      expect(response.body.error).toBe("invalid_client_metadata");
    });

    it("Maps malformed registration JSON to OAuth JSON", async () => {
      const response = await request(app.getHttpServer())
        .post("/oauth/register")
        .set("Content-Type", "application/json")
        .send('{"client_name":')
        .expect(400);
      expect(response.body).toMatchObject({
        error: "invalid_client_metadata",
        error_description: expect.any(String),
      });
      expect(response.body).not.toHaveProperty("statusCode");
    });
  });

  describe("OAuth authorization requests", () => {
    it("Redirects missing PKCE with the original state", async () => {
      const client = await registerClient("Missing PKCE");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          state: "original state",
        })
        .redirects(0)
        .expect(302);
      const location = new URL(response.headers.location);
      expect(location.searchParams.get("error")).toBe("invalid_request");
      expect(location.searchParams.get("state")).toBe("original state");
      expect(location.searchParams.get("iss")).toBe(PUBLIC_URL);
      expect(location.searchParams.has("code")).toBe(false);
    });

    it("Rejects the plain PKCE method through the registered redirect", async () => {
      const client = await registerClient("Plain PKCE");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          code_challenge: "a".repeat(43),
          code_challenge_method: "plain",
          state: "s",
        })
        .redirects(0)
        .expect(302);
      expect(new URL(response.headers.location).searchParams.get("error")).toBe(
        "invalid_request",
      );
    });

    it("Rejects an unregistered redirect without a Location header", async () => {
      const client = await registerClient("Redirect mismatch");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: "https://evil.example/cb",
        })
        .expect(400);
      expect(response.headers.location).toBeUndefined();
      expect(response.body.error).toBe("invalid_redirect_uri");
      expect(response.body.error_description).toBe(
        "The redirect URI is not registered for this client.",
      );
    });

    it("Rejects an unknown client without a Location header", async () => {
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: randomUUID(),
          redirect_uri: REDIRECT_URI,
        })
        .expect(400);
      expect(response.headers.location).toBeUndefined();
      expect(response.body.error).toBe("invalid_client");
      expect(response.body.error_description).toBe(
        "The client identifier is invalid.",
      );
    });

    it("Rejects a resource other than the MCP resource with state", async () => {
      const client = await registerClient("Wrong resource");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          code_challenge: sha256("r".repeat(43)),
          code_challenge_method: "S256",
          resource: "https://other.example/mcp",
          state: "target-state",
        })
        .redirects(0)
        .expect(302);
      const redirect = new URL(response.headers.location);
      expect(redirect.searchParams.get("error")).toBe("invalid_target");
      expect(redirect.searchParams.get("state")).toBe("target-state");
      expect(redirect.searchParams.get("iss")).toBe(PUBLIC_URL);
    });

    it("Rejects unsupported scopes instead of stripping them", async () => {
      const client = await registerClient("Wrong scope");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          code_challenge: sha256("s".repeat(43)),
          code_challenge_method: "S256",
          scope: "taskory profile",
          state: "scope-state",
        })
        .redirects(0)
        .expect(302);
      const redirect = new URL(response.headers.location);
      expect(redirect.searchParams.get("error")).toBe("invalid_scope");
      expect(redirect.searchParams.get("state")).toBe("scope-state");
      expect(redirect.searchParams.get("iss")).toBe(PUBLIC_URL);
    });

    it("Redirects unsupported response types with unsupported_response_type", async () => {
      const client = await registerClient("Unsupported response");
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "token",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          state: "x",
        })
        .redirects(0)
        .expect(302);
      expect(new URL(response.headers.location).searchParams.get("error")).toBe(
        "unsupported_response_type",
      );
    });

    it("Preserves encoded state without injecting query parameters", async () => {
      const client = await registerClient("State encoding");
      const state = "value&admin=true#fragment";
      const response = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query({
          response_type: "code",
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          code_challenge: "a".repeat(43),
          code_challenge_method: "S256",
          state,
        })
        .redirects(0)
        .expect(302);
      const requestId = new URL(response.headers.location).searchParams.get(
        "request",
      )!;
      const user = await registerUser("state@example.com", "State User");
      const decision = await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${requestId}/decision`)
        .set(bearer(user.token))
        .send({ approve: true })
        .expect(201);
      const location = new URL(decision.body.redirectUrl);
      expect(location.searchParams.get("state")).toBe(state);
      expect(location.searchParams.has("admin")).toBe(false);
    });
  });

  describe("OAuth consent decisions", () => {
    it("Denies consent with the original state", async () => {
      const user = await registerUser("deny@example.com", "Deny User");
      const client = await registerClient("Denied App");
      const id = await startAuthorization(
        client.client_id,
        sha256("v".repeat(43)),
        "deny-state",
      );
      const response = await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: false })
        .expect(201);
      const redirect = new URL(response.body.redirectUrl);
      expect(redirect.searchParams.get("error")).toBe("access_denied");
      expect(redirect.searchParams.get("state")).toBe("deny-state");
      expect(redirect.searchParams.get("iss")).toBe(PUBLIC_URL);
    });

    it.each(["true", "false", 1, 0, null, [], {}, undefined])(
      "Rejects non-boolean approve %p before claiming",
      async (approve) => {
        const user = await registerUser(
          `strict-${randomUUID()}@example.com`,
          "Strict User",
        );
        const client = await registerClient("Strict Decision");
        const id = await startAuthorization(
          client.client_id,
          sha256("x".repeat(43)),
          "strict",
        );
        const body = approve === undefined ? {} : { approve };
        await request(app.getHttpServer())
          .post(`/api/v1/oauth/requests/${id}/decision`)
          .set(bearer(user.token))
          .send(body)
          .expect(400);
        await request(app.getHttpServer())
          .get(`/api/v1/oauth/requests/${id}`)
          .set(bearer(user.token))
          .expect(200);
      },
    );

    it("Rejects a second decision", async () => {
      const user = await registerUser("twice@example.com", "Twice User");
      const client = await registerClient("One Decision");
      const id = await startAuthorization(
        client.client_id,
        sha256("w".repeat(43)),
        "twice",
      );
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: false })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: true })
        .expect(404);
    });

    it("Requires a JWT for the request lookup", async () => {
      const client = await registerClient("Lookup JWT");
      const id = await startAuthorization(
        client.client_id,
        sha256("l".repeat(43)),
        "lookup",
      );
      await request(app.getHttpServer())
        .get(`/api/v1/oauth/requests/${id}`)
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .send({ approve: true })
        .expect(401);
    });

    it("Rejects API keys and OAuth access tokens for consent", async () => {
      const user = await registerUser("jwt-only@example.com", "JWT Only");
      const key = await request(app.getHttpServer())
        .post("/api/v1/api-keys")
        .set(bearer(user.token))
        .send({ name: "advanced" })
        .expect(201);
      const client = await registerClient("JWT Only OAuth");
      const id = await startAuthorization(
        client.client_id,
        sha256("q".repeat(43)),
        "jwt-only",
      );
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(key.body.key))
        .send({ approve: true })
        .expect(401);
      const oauthToken = await issueAccessToken(user.token, client.client_id);
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(oauthToken))
        .send({ approve: true })
        .expect(401);
    });

    it("Returns the app envelope for unknown and expired requests", async () => {
      const user = await registerUser("expired@example.com", "Expired User");
      await request(app.getHttpServer())
        .get(`/api/v1/oauth/requests/${randomUUID()}`)
        .set(bearer(user.token))
        .expect(404)
        .expect(({ body }) => expect(body).toHaveProperty("code", "NOT_FOUND"));
      const client = await registerClient("Expired Request");
      const id = await startAuthorization(
        client.client_id,
        sha256("e".repeat(43)),
        "expired",
      );
      currentTime = new Date(currentTime.getTime() + 11 * 60 * 1000);
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: true })
        .expect(404)
        .expect(({ body }) => expect(body).toHaveProperty("code", "NOT_FOUND"));
    });
  });

  describe("OAuth token endpoint", () => {
    it("Rejects a wrong verifier", async () => {
      const grant = await prepareGrant("wrong-verifier@example.com");
      const response = await tokenCode(grant, "b".repeat(43)).expect(400);
      expect(response.body.error).toBe("invalid_grant");
      expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("Rejects a verifier shorter than the PKCE minimum", async () => {
      const grant = await prepareGrant("short-verifier@example.com");
      const response = await tokenCode(grant, "short").expect(400);
      expect(response.body.error).toBe("invalid_request");
    });

    it("Rejects a mismatched redirect URI and client id", async () => {
      const grant = await prepareGrant("mismatch@example.com");
      await tokenCode({ ...grant, redirectUri: "https://elsewhere.example/cb" })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
      await tokenCode({ ...grant, clientId: randomUUID() })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });

    it.each(["revoked", "resource-mismatch"])(
      "Rejects code exchange for a %s authorization without persisting tokens",
      async (change) => {
        const grant = await prepareGrant(`invalid-${change}@example.com`);
        const authorization = await app
          .get(DataSource)
          .getRepository(OAuthAuthorization)
          .findOneByOrFail({ clientId: grant.clientId });
        if (change === "revoked") {
          await app
            .get(DataSource)
            .getRepository(OAuthAuthorization)
            .update(authorization.id, { revokedAt: currentTime });
        } else {
          await app
            .get(DataSource)
            .getRepository(OAuthAuthorization)
            .update(authorization.id, {
              resource: "https://other.example/mcp",
            });
        }
        await tokenCode(grant)
          .expect(400)
          .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
        expect(
          await app.get(DataSource).getRepository(OAuthToken).count(),
        ).toBe(0);
      },
    );

    it("Revokes tokens issued from a reused code", async () => {
      const grant = await prepareGrant("code-reuse@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      const rotated = await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: grant.clientId,
        })
        .expect(200);
      await tokenCode(grant)
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(rotated.body.access_token))
        .expect(401);
      await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: rotated.body.refresh_token,
          client_id: grant.clientId,
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });

    it("Rejects an expired authorization code", async () => {
      const grant = await prepareGrant("expired-code@example.com");
      currentTime = new Date(currentTime.getTime() + 11 * 60 * 1000);
      await tokenCode(grant)
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });

    it("Rejects unsupported and missing grant types", async () => {
      await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({ grant_type: "client_credentials" })
        .expect(400)
        .expect(({ body }) =>
          expect(body.error).toBe("unsupported_grant_type"),
        );
      await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({})
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_request"));
    });

    it("Maps malformed form data to invalid_request", async () => {
      const response = await request(app.getHttpServer())
        .post("/oauth/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("grant_type=authorization_code&code=%")
        .expect(400);
      expect(response.body.error).toBe("invalid_request");
      expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("Rejects repeated form fields instead of accepting an array", async () => {
      const response = await request(app.getHttpServer())
        .post("/oauth/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("grant_type=authorization_code&code=first&code=second")
        .expect(400);
      expect(response.body.error).toBe("invalid_request");
    });

    it("Rejects a token request naming a different resource", async () => {
      const grant = await prepareGrant("wrong-token-resource@example.com");
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code: grant.code,
          code_verifier: grant.verifier,
          client_id: grant.clientId,
          redirect_uri: grant.redirectUri,
          resource: "https://other.example/mcp",
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_target"));
      await tokenCode(grant).expect(200);
    });

    it("Accepts a JSON token request", async () => {
      const grant = await prepareGrant("json-grant@example.com");
      const response = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code: grant.code,
          code_verifier: grant.verifier,
          client_id: grant.clientId,
          redirect_uri: grant.redirectUri,
        })
        .expect(200);
      expect(response.body.access_token).toMatch(/^to_/);
    });

    it("Rejects refresh for a different client", async () => {
      const grant = await prepareGrant("wrong-refresh-client@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: grant.clientId,
          resource: "https://other.example/mcp",
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_target"));
      await request(app.getHttpServer())
        .post("/oauth/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: randomUUID(),
        })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe("invalid_grant"));
    });

    it("Rejects an expired access token", async () => {
      const grant = await prepareGrant("expired-access@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      currentTime = new Date(currentTime.getTime() + 61 * 60 * 1000);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(tokens.access_token))
        .expect(401);
    });
  });

  describe("OAuth revocation", () => {
    it("Revokes the authorization when its refresh token is revoked", async () => {
      const grant = await prepareGrant("revoke-refresh@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: tokens.refresh_token, client_id: grant.clientId })
        .expect(200)
        .expect({});
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: grant.clientId,
        })
        .expect(400);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(tokens.access_token))
        .expect(401);
    });

    it("Keeps no live token when connected-app revocation overlaps code exchange", async () => {
      const user = await registerUser(
        "overlap-revoke@example.com",
        "Overlap revoke",
      );
      const grant = await prepareGrant(
        "overlap-revoke@example.com",
        user.token,
      );
      const authorization = await app
        .get(DataSource)
        .getRepository(OAuthAuthorization)
        .findOneByOrFail({ clientId: grant.clientId });
      const [exchange] = await Promise.all([
        tokenCode(grant),
        request(app.getHttpServer())
          .delete(`/api/v1/connected-apps/${authorization.id}`)
          .set(bearer(user.token)),
      ]);
      const currentAuthorization = await app
        .get(DataSource)
        .getRepository(OAuthAuthorization)
        .findOneByOrFail({ id: authorization.id });
      const tokens = await app
        .get(DataSource)
        .getRepository(OAuthToken)
        .findBy({ authorizationId: authorization.id });
      expect(currentAuthorization.revokedAt).not.toBeNull();
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
      expect(exchange.status === 200 || exchange.status === 400).toBe(true);
    });

    it("Keeps no live token when connected-app revocation overlaps refresh", async () => {
      const user = await registerUser(
        "overlap-refresh-revoke@example.com",
        "Overlap refresh revoke",
      );
      const grant = await prepareGrant(
        "overlap-refresh-revoke@example.com",
        user.token,
      );
      const issued = await tokenCode(grant).expect(200);
      const authorization = await app
        .get(DataSource)
        .getRepository(OAuthAuthorization)
        .findOneByOrFail({ clientId: grant.clientId });
      const [refresh] = await Promise.all([
        request(app.getHttpServer()).post("/oauth/token").type("form").send({
          grant_type: "refresh_token",
          refresh_token: issued.body.refresh_token,
          client_id: grant.clientId,
        }),
        request(app.getHttpServer())
          .delete(`/api/v1/connected-apps/${authorization.id}`)
          .set(bearer(user.token)),
      ]);
      const currentAuthorization = await app
        .get(DataSource)
        .getRepository(OAuthAuthorization)
        .findOneByOrFail({ id: authorization.id });
      const tokens = await app
        .get(DataSource)
        .getRepository(OAuthToken)
        .findBy({ authorizationId: authorization.id });
      expect(currentAuthorization.revokedAt).not.toBeNull();
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
      expect(refresh.status === 200 || refresh.status === 400).toBe(true);
    });

    it("Revokes only an access token when given that access token", async () => {
      const grant = await prepareGrant("revoke-access@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({
          token: tokens.access_token,
          token_type_hint: "access_token",
          client_id: grant.clientId,
        })
        .expect(200)
        .expect({});
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(tokens.access_token))
        .expect(401);
      const refresh = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
          client_id: grant.clientId,
        })
        .expect(200);
      expect(refresh.body.access_token).toMatch(/^to_/);
    });

    it("Ignores unknown tokens and mismatched client identifiers", async () => {
      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: "unknown-token" })
        .expect(200)
        .expect({});
      const grant = await prepareGrant("revoke-client-id@example.com");
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: tokens.access_token, client_id: randomUUID() })
        .expect(200)
        .expect({});
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(tokens.access_token))
        .expect(200);
    });
  });

  describe("Connected app management", () => {
    it("Lists app metadata, isolates users, and revokes deleted app tokens", async () => {
      const user = await registerUser(
        "connected@example.com",
        "Connected User",
      );
      const other = await registerUser(
        "other-connected@example.com",
        "Other User",
      );
      const grant = await prepareGrant(
        "connected-grant@example.com",
        user.token,
      );
      const tokens = await exchangeCode(
        grant.clientId,
        grant.code,
        grant.verifier,
      );
      const listing = await request(app.getHttpServer())
        .get("/api/v1/connected-apps")
        .set(bearer(user.token))
        .expect(200);
      expect(listing.body).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          clientName: "Grant Client",
          createdAt: expect.any(String),
          lastUsedAt: null,
        }),
      ]);
      expect(
        (
          await request(app.getHttpServer())
            .get("/api/v1/connected-apps")
            .set(bearer(other.token))
            .expect(200)
        ).body,
      ).toEqual([]);
      await request(app.getHttpServer())
        .delete(`/api/v1/connected-apps/${listing.body[0].id}`)
        .set(bearer(user.token))
        .expect(204);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set(bearer(tokens.access_token))
        .expect(401);
    });

    it("Returns not found when deleting another user's app", async () => {
      const owner = await registerUser("owner@example.com", "Owner");
      const other = await registerUser("stranger@example.com", "Stranger");
      const grant = await prepareGrant("owned-grant@example.com", owner.token);
      const listing = await request(app.getHttpServer())
        .get("/api/v1/connected-apps")
        .set(bearer(owner.token))
        .expect(200);
      expect(listing.body).toHaveLength(1);
      await request(app.getHttpServer())
        .delete(`/api/v1/connected-apps/${listing.body[0].id}`)
        .set(bearer(other.token))
        .expect(404);
      await request(app.getHttpServer())
        .delete("/api/v1/connected-apps/not-a-uuid")
        .set(bearer(owner.token))
        .expect(400);
      await request(app.getHttpServer())
        .get("/api/v1/connected-apps")
        .expect(401);
      expect(grant.clientId).toBeTruthy();
    });
  });

  describe("OAuth HTTP cross-cutting behavior", () => {
    it("Adds CORS only to OAuth discovery and client endpoints", async () => {
      for (const path of [
        "/.well-known/oauth-authorization-server",
        "/.well-known/oauth-protected-resource",
      ]) {
        await request(app.getHttpServer())
          .get(path)
          .expect(200)
          .expect(({ headers }) =>
            expect(headers["access-control-allow-origin"]).toBe("*"),
          );
      }
      for (const path of ["/oauth/register", "/oauth/token", "/oauth/revoke"]) {
        const response = await request(app.getHttpServer())
          .options(path)
          .expect(204);
        expect(response.headers["access-control-allow-origin"]).toBe("*");
        expect(response.headers["access-control-allow-methods"]).toBe(
          "GET, POST, OPTIONS",
        );
        expect(response.headers["access-control-allow-headers"]).toBe(
          "Content-Type, Authorization",
        );
      }
      await request(app.getHttpServer())
        .get("/oauth/authorize")
        .expect(400)
        .expect(({ headers }) =>
          expect(headers["access-control-allow-origin"]).toBeUndefined(),
        );
      await request(app.getHttpServer())
        .get("/api/v1/activities")
        .expect(401)
        .expect(({ headers }) =>
          expect(headers["access-control-allow-origin"]).toBeUndefined(),
        );
    });

    it("Rate limits token requests with OAuth JSON", async () => {
      for (let index = 0; index < 5; index += 1) {
        await request(app.getHttpServer())
          .post("/oauth/token")
          .send({ grant_type: "unsupported" })
          .expect(400);
      }
      const tokenLimited = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({ grant_type: "unsupported" })
        .expect(429);
      expect(tokenLimited.body).toMatchObject({
        error: "rate_limit_exceeded",
        error_description: expect.any(String),
      });
      expect(tokenLimited.headers["cache-control"]).toBe("no-store");
    });

    it("Rate limits revocation requests with OAuth JSON", async () => {
      for (let index = 0; index < 5; index += 1) {
        await request(app.getHttpServer())
          .post("/oauth/revoke")
          .send({ token: `unknown-${index}` })
          .expect(200);
      }
      const response = await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: "unknown-sixth" })
        .expect(429);
      expect(response.body).toMatchObject({ error: "rate_limit_exceeded" });
    });

    it("Rate limits registration requests with OAuth JSON", async () => {
      for (let index = 0; index < 5; index += 1) {
        await request(app.getHttpServer())
          .post("/oauth/register")
          .send({
            client_name: `Limited ${index}`,
            redirect_uris: [REDIRECT_URI],
          })
          .expect(201);
      }
      const registrationLimited = await request(app.getHttpServer())
        .post("/oauth/register")
        .send({ client_name: "Limited sixth", redirect_uris: [REDIRECT_URI] })
        .expect(429);
      expect(registrationLimited.body.error).toBe("rate_limit_exceeded");
    });

    it("Rate limits decisions with the app error envelope", async () => {
      const user = await registerUser(
        "throttle-decision@example.com",
        "Throttle Decision",
      );
      const client = await registerClient("Throttle Decision Client");
      const id = await startAuthorization(
        client.client_id,
        sha256("t".repeat(43)),
        "throttle",
      );
      await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: false })
        .expect(201);
      for (let index = 0; index < 4; index += 1) {
        await request(app.getHttpServer())
          .post(`/api/v1/oauth/requests/${id}/decision`)
          .set(bearer(user.token))
          .send({ approve: true })
          .expect(404);
      }
      const decisionLimited = await request(app.getHttpServer())
        .post(`/api/v1/oauth/requests/${id}/decision`)
        .set(bearer(user.token))
        .send({ approve: true })
        .expect(429);
      expect(decisionLimited.body).toHaveProperty("code", "TOO_MANY_REQUESTS");
      expect(decisionLimited.body).not.toHaveProperty("error");
    });

    it("Rate limits unauthenticated authorization starts", async () => {
      const client = await registerClient("Authorize Rate Limit");
      const query = {
        response_type: "code",
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        code_challenge: "a".repeat(43),
        code_challenge_method: "S256",
      };
      await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query(query)
        .redirects(0)
        .expect(302);
      await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query(query)
        .redirects(0)
        .expect(302);
      const limited = await request(app.getHttpServer())
        .get("/oauth/authorize")
        .query(query)
        .expect(429);
      expect(limited.body).toMatchObject({
        error: "rate_limit_exceeded",
        error_description: expect.any(String),
      });
      expect(limited.headers.location).toBeUndefined();
    });
  });
});

async function registerUser(
  email: string,
  name: string,
): Promise<{ token: string; email: string }> {
  const response = await request(appServer())
    .post("/api/v1/auth/register")
    .send({ email, name, password: "password-123" })
    .expect(201);
  return { token: response.body.token, email };
}

let activeApp: INestApplication;
function appServer() {
  return activeApp.getHttpServer();
}
function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
async function registerClient(client_name: string) {
  return (
    await request(appServer())
      .post("/oauth/register")
      .send({ client_name, redirect_uris: [REDIRECT_URI] })
      .expect(201)
  ).body;
}
async function createActivity(token: string, title: string) {
  await request(appServer())
    .post("/api/v1/activities")
    .set(bearer(token))
    .send({ date: "2026-01-02", title })
    .expect(201);
}
async function startAuthorization(
  clientId: string,
  challenge: string,
  state: string,
) {
  const response = await request(appServer())
    .get("/oauth/authorize")
    .query({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    })
    .redirects(0)
    .expect(302);
  return new URL(response.headers.location).searchParams.get("request")!;
}
async function exchangeCode(clientId: string, code: string, verifier: string) {
  return (
    await request(appServer())
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
      })
      .expect(200)
  ).body;
}
async function issueAccessToken(
  userToken: string,
  clientId: string,
): Promise<string> {
  const verifier = "z".repeat(43);
  const id = await startAuthorization(
    clientId,
    sha256(verifier),
    "token-for-test",
  );
  const decision = await request(appServer())
    .post(`/api/v1/oauth/requests/${id}/decision`)
    .set(bearer(userToken))
    .send({ approve: true })
    .expect(201);
  const code = new URL(decision.body.redirectUrl).searchParams.get("code")!;
  const tokens = await exchangeCode(clientId, code, verifier);
  return tokens.access_token;
}
interface PreparedGrant {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}
async function prepareGrant(
  email: string,
  userToken?: string,
): Promise<PreparedGrant> {
  const user = userToken
    ? { token: userToken, email }
    : await registerUser(email, "Grant User");
  const client = await registerClient("Grant Client");
  const verifier = "g".repeat(43);
  const id = await startAuthorization(
    client.client_id,
    sha256(verifier),
    "grant-state",
  );
  const decision = await request(appServer())
    .post(`/api/v1/oauth/requests/${id}/decision`)
    .set(bearer(user.token))
    .send({ approve: true })
    .expect(201);
  const code = new URL(decision.body.redirectUrl).searchParams.get("code")!;
  return {
    clientId: client.client_id,
    code,
    verifier,
    redirectUri: REDIRECT_URI,
  };
}
function tokenCode(grant: PreparedGrant, verifier = grant.verifier) {
  return request(appServer()).post("/oauth/token").type("form").send({
    grant_type: "authorization_code",
    code: grant.code,
    code_verifier: verifier,
    client_id: grant.clientId,
    redirect_uri: grant.redirectUri,
  });
}
