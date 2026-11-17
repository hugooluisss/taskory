import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import { User } from "../users/entities/user.entity";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { OAuthAuthorizationRequest } from "./entities/oauth-authorization-request.entity";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthClient } from "./entities/oauth-client.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { OAuthAuthorizationCodesRepository } from "./oauth-authorization-codes.repository";
import { OAuthAuthorizationRequestsRepository } from "./oauth-authorization-requests.repository";
import { OAuthAuthorizationsRepository } from "./oauth-authorizations.repository";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { OAuthTokensRepository } from "./oauth-tokens.repository";
import { OAuthPersistenceError } from "./oauth-persistence.error";

describe("OAuth persistence repositories", () => {
  let source: DataSource;
  let clients: OAuthClientsRepository;
  let requests: OAuthAuthorizationRequestsRepository;
  let authorizations: OAuthAuthorizationsRepository;
  let codes: OAuthAuthorizationCodesRepository;
  let tokens: OAuthTokensRepository;
  let transactions: TransactionRunner;
  let databasePath: string;

  beforeEach(async () => {
    databasePath = join(tmpdir(), `taskory-oauth-${randomUUID()}.sqlite`);
    source = await new DataSource({
      type: "better-sqlite3",
      database: databasePath,
      entities: [
        User,
        OAuthClient,
        OAuthAuthorizationRequest,
        OAuthAuthorization,
        OAuthAuthorizationCode,
        OAuthToken,
      ],
      synchronize: true,
      prepareDatabase: (database) => database.exec("PRAGMA foreign_keys = ON"),
    }).initialize();
    transactions = new TransactionRunner(source);
    clients = new OAuthClientsRepository(source.getRepository(OAuthClient));
    requests = new OAuthAuthorizationRequestsRepository(
      source.getRepository(OAuthAuthorizationRequest),
      transactions,
    );
    authorizations = new OAuthAuthorizationsRepository(
      source.getRepository(OAuthAuthorization),
      transactions,
    );
    codes = new OAuthAuthorizationCodesRepository(
      source.getRepository(OAuthAuthorizationCode),
    );
    tokens = new OAuthTokensRepository(
      source.getRepository(OAuthToken),
      transactions,
    );
    await source.getRepository(User).save({
      id: "owner",
      email: "owner@example.com",
      name: "Owner",
      passwordHash: "hash",
      language: "en",
    });
    await source.getRepository(User).save({
      id: "other",
      email: "other@example.com",
      name: "Other",
      passwordHash: "hash",
      language: "en",
    });
  });

  afterEach(async () => {
    await source.destroy();
    await unlink(databasePath).catch(() => undefined);
  });

  it("Stores only token hashes", async () => {
    const { authorization, code } = await createAuthorization();
    const plaintext = "to_secret-usable-token";
    const token = await tokens.create({
      authorizationId: authorization.id,
      kind: "access",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: null,
      codeId: code.id,
    });
    const rows = await source.query("SELECT * FROM oauth_tokens");
    expect(rows[0].tokenHash).toBe("a".repeat(64));
    expect(JSON.stringify(rows)).not.toContain(plaintext);
    expect(token.tokenHash).not.toBe(plaintext);
  });

  it("Consumes an authorization code once under concurrent use", async () => {
    const { code } = await createAuthorization();
    const outcomes = await Promise.all([
      codes.consume(code.id, new Date()),
      codes.consume(code.id, new Date()),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it("Atomically consumes a code and inserts both hashed token records", async () => {
    const { authorization, code } = await createAuthorization();
    const values = ["access", "refresh"].map((kind) => ({
      authorizationId: authorization.id,
      kind: kind as "access" | "refresh",
      tokenHash: kind === "access" ? "w".repeat(64) : "x".repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: null,
      codeId: code.id,
    }));
    expect(
      await tokens.issueCodeTokens(
        code.id,
        new Date(),
        "http://localhost:3999/mcp",
        values,
      ),
    ).toBe(true);
    expect(
      await tokens.issueCodeTokens(
        code.id,
        new Date(),
        "http://localhost:3999/mcp",
        values,
      ),
    ).toBe(false);
    expect(
      await source.getRepository(OAuthToken).findBy({ codeId: code.id }),
    ).toHaveLength(2);
    expect(
      JSON.stringify(await source.query("SELECT * FROM oauth_tokens")),
    ).not.toContain("to_");
  });

  it("Atomically rotates a refresh token with both replacement records", async () => {
    const { authorization } = await createAuthorization();
    const old = await createToken(authorization.id, "refresh", "m");
    const replacements = ["access", "refresh"].map((kind) => ({
      authorizationId: authorization.id,
      kind: kind as "access" | "refresh",
      tokenHash: kind === "access" ? "n".repeat(64) : "o".repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: old.id,
      codeId: null,
    }));
    expect(
      await tokens.rotateRefreshTokens(old.id, replacements, new Date()),
    ).toBe(true);
    expect(
      await tokens.rotateRefreshTokens(old.id, replacements, new Date()),
    ).toBe(false);
    expect(
      await source.getRepository(OAuthToken).findBy({ parentTokenId: old.id }),
    ).toHaveLength(2);
  });

  it("Roll back refresh consumption if replacement token insertion fails", async () => {
    const { authorization } = await createAuthorization();
    const old = await createToken(authorization.id, "refresh", "p");
    await expect(
      tokens.rotateRefreshTokens(
        old.id,
        [
          {
            authorizationId: "missing-authorization",
            kind: "access",
            tokenHash: "r".repeat(64),
            expiresAt: new Date(Date.now() + 3600000),
            parentTokenId: old.id,
            codeId: null,
          },
        ],
        new Date(),
      ),
    ).rejects.toBeInstanceOf(OAuthPersistenceError);
    await expect(
      source.getRepository(OAuthToken).findOneBy({ id: old.id }),
    ).resolves.toMatchObject({
      rotatedAt: null,
    });
    expect(await tokens.consumeActiveRefresh(old.id, new Date())).toBe(true);
  });

  it("Consumes a code only when it is unexpired and unused", async () => {
    const { code } = await createAuthorization();
    expect(await codes.consumeValid(code.id, new Date())).toBe(true);
    expect(await codes.consumeValid(code.id, new Date())).toBe(false);
    const expired = await codes.create({
      authorizationId: code.authorizationId,
      codeHash: "y".repeat(64),
      codeChallenge: "i".repeat(43),
      redirectUri: "https://app.example/cb",
      expiresAt: new Date(Date.now() - 1),
    });
    expect(await codes.consumeValid(expired.id, new Date())).toBe(false);
  });

  it("Finds an authorization by system authorization id", async () => {
    const { authorization } = await createAuthorization();
    await expect(
      authorizations.findById(authorization.id),
    ).resolves.toMatchObject({
      userId: "owner",
    });
  });

  it("Revokes an authorization by explicit system id in one transaction", async () => {
    const { authorization } = await createAuthorization();
    const token = await createToken(authorization.id, "refresh", "q");
    expect(
      await authorizations.revokeAuthorizationById(
        authorization.id,
        new Date(),
      ),
    ).toBe(true);
    await expect(
      source.getRepository(OAuthToken).findOneBy({ id: token.id }),
    ).resolves.toMatchObject({
      revokedAt: expect.any(Date),
    });
  });

  it("Finds a token with its authorization by hash", async () => {
    const { authorization } = await createAuthorization();
    const token = await createToken(authorization.id, "access", "r");
    await expect(
      tokens.findWithAuthorizationByHash(token.tokenHash),
    ).resolves.toMatchObject({
      authorization: { userId: "owner" },
    });
  });

  it("Consumes a refresh only once and only while active", async () => {
    const { authorization } = await createAuthorization();
    const active = await createToken(authorization.id, "refresh", "s");
    const expired = await tokens.create({
      authorizationId: authorization.id,
      kind: "refresh",
      tokenHash: "t".repeat(64),
      expiresAt: new Date(Date.now() - 1),
      parentTokenId: null,
      codeId: null,
    });
    expect(await tokens.consumeActiveRefresh(active.id, new Date())).toBe(true);
    expect(await tokens.consumeActiveRefresh(active.id, new Date())).toBe(
      false,
    );
    expect(await tokens.consumeActiveRefresh(expired.id, new Date())).toBe(
      false,
    );
  });

  it("Touches token last use only after its throttle threshold", async () => {
    const { authorization } = await createAuthorization();
    const token = await createToken(authorization.id, "access", "u");
    const now = new Date("2026-01-01T00:02:00Z");
    expect(
      await tokens.touchLastUsed(
        token.id,
        now,
        new Date("2026-01-01T00:01:00Z"),
      ),
    ).toBe(true);
    expect(
      await tokens.touchLastUsed(
        token.id,
        now,
        new Date("2026-01-01T00:01:00Z"),
      ),
    ).toBe(false);
  });

  it("Touches authorization last use only after its throttle threshold", async () => {
    const { authorization } = await createAuthorization();
    const now = new Date("2026-01-01T00:02:00Z");
    expect(
      await authorizations.touchLastUsed(
        authorization.id,
        now,
        new Date("2026-01-01T00:01:00Z"),
      ),
    ).toBe(true);
    expect(
      await authorizations.touchLastUsed(
        authorization.id,
        now,
        new Date("2026-01-01T00:01:00Z"),
      ),
    ).toBe(false);
  });

  it("Revokes a token by id only once", async () => {
    const { authorization } = await createAuthorization();
    const token = await createToken(authorization.id, "access", "v");
    expect(await tokens.revokeToken(token.id, new Date())).toBe(true);
    expect(await tokens.revokeToken(token.id, new Date())).toBe(false);
  });

  it("Atomically decides only pending, unexpired requests", async () => {
    const { client } = await createAuthorization();
    const request = await requests.create({
      clientId: client.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "g".repeat(43),
      state: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    const at = new Date();
    expect(await requests.markDecidedBeforeExpiry(request.id, at)).toBe(true);
    expect(await requests.markDecidedBeforeExpiry(request.id, at)).toBe(false);
    const boundary = await requests.create({
      clientId: client.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "g".repeat(43),
      state: null,
      expiresAt: at,
    });
    expect(await requests.markDecidedBeforeExpiry(boundary.id, at)).toBe(false);
  });

  it("Consumes a refresh token once under concurrent rotation", async () => {
    const { authorization } = await createAuthorization();
    const refresh = await tokens.create({
      authorizationId: authorization.id,
      kind: "refresh",
      tokenHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: null,
      codeId: null,
    });
    const outcomes = await Promise.all([
      tokens.consumeRefresh(refresh.id, new Date()),
      tokens.consumeRefresh(refresh.id, new Date()),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it("Revokes an authorization and every token in one transaction", async () => {
    const { authorization } = await createAuthorization();
    const access = await createToken(authorization.id, "access", "c");
    const refresh = await createToken(authorization.id, "refresh", "d");
    expect(
      await authorizations.revokeAuthorization(
        "owner",
        authorization.id,
        new Date(),
      ),
    ).toBe(true);
    expect(
      await source
        .getRepository(OAuthAuthorization)
        .findOneBy({ id: authorization.id }),
    ).toMatchObject({ revokedAt: expect.any(Date) });
    expect(
      await source
        .getRepository(OAuthToken)
        .findBy({ authorizationId: authorization.id }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: access.id, revokedAt: expect.any(Date) }),
        expect.objectContaining({
          id: refresh.id,
          revokedAt: expect.any(Date),
        }),
      ]),
    );
  });

  it("Translates database constraint errors into domain errors", async () => {
    await createAuthorization();
    await expect(
      codes.create({
        authorizationId: "missing-authorization",
        codeHash: "z".repeat(64),
        codeChallenge: "i".repeat(43),
        redirectUri: "https://app.example/cb",
        expiresAt: new Date(Date.now() + 600000),
      }),
    ).rejects.toBeInstanceOf(OAuthPersistenceError);
  });

  it("Scopes connected authorization reads and revokes by user", async () => {
    const { authorization } = await createAuthorization();
    await expect(
      authorizations.find("other", authorization.id),
    ).resolves.toBeNull();
    await expect(
      authorizations.find("owner", authorization.id),
    ).resolves.toMatchObject({ id: authorization.id });
    expect(
      await authorizations.revokeAuthorization(
        "other",
        authorization.id,
        new Date(),
      ),
    ).toBe(false);
    expect(
      await authorizations.revokeAuthorization(
        "owner",
        authorization.id,
        new Date(),
      ),
    ).toBe(true);
  });

  it("Rolls back approval claim and authorization when code insertion fails", async () => {
    const { client, code } = await createAuthorization();
    const pending = await requests.create({
      clientId: client.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "j".repeat(43),
      state: null,
      expiresAt: new Date(Date.now() + 600000),
    });
    const authorizationsBefore = await source
      .getRepository(OAuthAuthorization)
      .count();

    await expect(
      requests.approveRequest(
        pending.id,
        "owner",
        client.id,
        "https://app.example/cb",
        "j".repeat(43),
        code.codeHash,
        new Date(),
        new Date(Date.now() + 600000),
        "http://localhost:3999/mcp",
      ),
    ).rejects.toBeInstanceOf(OAuthPersistenceError);

    await expect(
      source
        .getRepository(OAuthAuthorizationRequest)
        .findOneBy({ id: pending.id }),
    ).resolves.toMatchObject({ decidedAt: null });
    await expect(
      source.getRepository(OAuthAuthorization).count(),
    ).resolves.toBe(authorizationsBefore);
  });

  it("Keeps a failed approval isolated from an overlapping code exchange", async () => {
    const { client, code } = await createAuthorization();
    const pending = await requests.create({
      clientId: client.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "j".repeat(43),
      state: null,
      expiresAt: new Date(Date.now() + 600000),
    });
    const tokenRows = ["v", "w"].map((seed, index) => ({
      authorizationId: code.authorizationId,
      kind: index === 0 ? ("access" as const) : ("refresh" as const),
      tokenHash: seed.repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: null,
      codeId: code.id,
    }));

    const [approval, exchange] = await Promise.allSettled([
      requests.approveRequest(
        pending.id,
        "owner",
        client.id,
        "https://app.example/cb",
        "j".repeat(43),
        code.codeHash,
        new Date(),
        new Date(Date.now() + 600000),
        "http://localhost:3999/mcp",
      ),
      tokens.issueCodeTokens(
        code.id,
        new Date(),
        "http://localhost:3999/mcp",
        tokenRows,
      ),
    ]);

    expect(approval.status).toBe("rejected");
    if (exchange.status === "rejected") throw exchange.reason;
    expect(exchange.value).toBe(true);
    expect(await source.getRepository(OAuthAuthorization).count()).toBe(1);
    expect(
      await source.getRepository(OAuthToken).findBy({ codeId: code.id }),
    ).toHaveLength(2);
    await expect(
      source
        .getRepository(OAuthAuthorizationRequest)
        .findOneBy({ id: pending.id }),
    ).resolves.toMatchObject({ decidedAt: null });
  });

  it("Retains replay evidence for live authorizations and pending clients", async () => {
    const { client, authorization, code } = await createAuthorization();
    const now = new Date();
    await source.getRepository(OAuthAuthorizationCode).update(code.id, {
      expiresAt: new Date(now.getTime() - 1000),
    });
    await tokens.create({
      authorizationId: authorization.id,
      kind: "refresh",
      tokenHash: "f".repeat(64),
      expiresAt: new Date(now.getTime() - 1000),
      parentTokenId: null,
      codeId: code.id,
    });
    await tokens.create({
      authorizationId: authorization.id,
      kind: "access",
      tokenHash: "e".repeat(64),
      expiresAt: new Date(now.getTime() + 86400000),
      parentTokenId: null,
      codeId: null,
    });
    await source.getRepository(OAuthClient).update(client.id, {
      createdAt: new Date(now.getTime() - 31 * 86400000),
    });
    const recentlyRevoked = await authorizations.create({
      userId: "owner",
      clientId: client.id,
      resource: "http://localhost:3999/mcp",
    });
    await source.getRepository(OAuthAuthorization).update(recentlyRevoked.id, {
      createdAt: new Date(now.getTime() - 31 * 86400000),
      revokedAt: new Date(now.getTime() - 86400000),
    });
    const pendingClient = await clients.create({
      name: "Pending",
      redirectUris: [],
    });
    await source.getRepository(OAuthClient).update(pendingClient.id, {
      createdAt: new Date(now.getTime() - 8 * 86400000),
    });
    await requests.create({
      clientId: pendingClient.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "e".repeat(43),
      state: null,
      expiresAt: new Date(now.getTime() + 60000),
    });

    await tokens.purgeExpired(
      now,
      new Date(now.getTime() - 7 * 86400000),
      new Date(now.getTime() - 30 * 86400000),
    );

    await expect(
      source.getRepository(OAuthAuthorizationCode).findOneBy({ id: code.id }),
    ).resolves.not.toBeNull();
    await expect(
      source.getRepository(OAuthToken).findOneBy({ tokenHash: "f".repeat(64) }),
    ).resolves.not.toBeNull();
    await expect(
      source
        .getRepository(OAuthAuthorization)
        .findOneBy({ id: recentlyRevoked.id }),
    ).resolves.not.toBeNull();
    await expect(clients.find(pendingClient.id)).resolves.not.toBeNull();
  });

  it("Purges a dead authorization with its codes, tokens and unused client", async () => {
    const { client, authorization, code } = await createAuthorization();
    const now = new Date();
    await source.getRepository(OAuthAuthorization).update(authorization.id, {
      createdAt: new Date(now.getTime() - 31 * 86400000),
      revokedAt: new Date(now.getTime() - 31 * 86400000),
    });
    await source.getRepository(OAuthClient).update(client.id, {
      createdAt: new Date(now.getTime() - 31 * 86400000),
    });
    await tokens.create({
      authorizationId: authorization.id,
      kind: "refresh",
      tokenHash: "d".repeat(64),
      expiresAt: new Date(now.getTime() + 86400000),
      parentTokenId: null,
      codeId: code.id,
    });

    await expect(
      tokens.purgeExpired(
        now,
        new Date(now.getTime() - 7 * 86400000),
        new Date(now.getTime() - 30 * 86400000),
      ),
    ).resolves.toMatchObject({ codes: 1, tokens: 1, clients: 1 });
    await expect(
      source
        .getRepository(OAuthAuthorization)
        .findOneBy({ id: authorization.id }),
    ).resolves.toBeNull();
    await expect(
      source.getRepository(OAuthAuthorizationCode).findOneBy({ id: code.id }),
    ).resolves.toBeNull();
    await expect(
      source.getRepository(OAuthToken).findOneBy({ tokenHash: "d".repeat(64) }),
    ).resolves.toBeNull();
    await expect(clients.find(client.id)).resolves.toBeNull();
  });

  it("Cascades client, user and authorization foreign keys", async () => {
    const { client, authorization } = await createAuthorization();
    const request = await requests.create({
      clientId: client.id,
      redirectUri: "https://app.example/cb",
      codeChallenge: "g".repeat(43),
      state: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    await createToken(authorization.id, "access", "h");
    await source.getRepository(User).delete("owner");
    await expect(
      source
        .getRepository(OAuthAuthorization)
        .findOneBy({ id: authorization.id }),
    ).resolves.toBeNull();
    await expect(source.getRepository(OAuthToken).find()).resolves.toHaveLength(
      0,
    );
    await source.getRepository(OAuthClient).delete(client.id);
    await expect(
      source
        .getRepository(OAuthAuthorizationRequest)
        .findOneBy({ id: request.id }),
    ).resolves.toBeNull();
  });

  async function createAuthorization() {
    const client = await clients.create({
      name: "Test app",
      redirectUris: ["https://app.example/cb"],
    });
    const authorization = await authorizations.create({
      userId: "owner",
      clientId: client.id,
      resource: "http://localhost:3999/mcp",
    });
    const code = await codes.create({
      authorizationId: authorization.id,
      codeHash: "z".repeat(64),
      codeChallenge: "i".repeat(43),
      redirectUri: "https://app.example/cb",
      expiresAt: new Date(Date.now() + 600000),
    });
    return { client, authorization, code };
  }

  async function createToken(
    authorizationId: string,
    kind: "access" | "refresh",
    seed: string,
  ) {
    return tokens.create({
      authorizationId,
      kind,
      tokenHash: seed.repeat(64),
      expiresAt: new Date(Date.now() + 3600000),
      parentTokenId: null,
      codeId: null,
    });
  }
});
