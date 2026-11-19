import { createHash } from "node:crypto";
import { OAuthTokenService } from "./oauth-token.service";
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_GRANT_MAX_LIFETIME_MS,
  OAUTH_REFRESH_TOKEN_TTL_MS,
} from "./constants";
import { hashToken } from "./token-hasher";
import { getMcpResource } from "./public-url";

describe("Token issuance and revocation", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let service: OAuthTokenService;
  let codes: { findByHash: jest.Mock };
  let authorizations: {
    findById: jest.Mock;
    revokeAuthorizationById: jest.Mock;
    touchLastUsed: jest.Mock;
  };
  let tokens: Record<string, jest.Mock>;
  let code: Record<string, unknown>;
  let refreshRecord: Record<string, unknown>;

  beforeEach(() => {
    code = {
      id: "code-1",
      authorizationId: "authorization-1",
      codeHash: hashToken("code"),
      codeChallenge: challenge,
      redirectUri: "https://client.example/cb",
      expiresAt: new Date(now.getTime() + 600000),
      usedAt: null,
    };
    refreshRecord = {
      id: "refresh-1",
      kind: "refresh",
      authorizationId: "authorization-1",
      expiresAt: new Date(now.getTime() + OAUTH_REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
      rotatedAt: null,
      authorization: {
        clientId: "client-1",
        revokedAt: null,
        userId: "user-1",
        resource: getMcpResource(),
        createdAt: now,
      },
    };
    codes = {
      findByHash: jest.fn().mockImplementation(async () => ({ ...code })),
    };
    authorizations = {
      findById: jest.fn().mockResolvedValue({
        id: "authorization-1",
        clientId: "client-1",
        userId: "user-1",
        createdAt: now,
      }),
      revokeAuthorizationById: jest.fn().mockResolvedValue(true),
      touchLastUsed: jest.fn().mockResolvedValue(true),
    };
    tokens = {
      create: jest.fn().mockResolvedValue({}),
      issueCodeTokens: jest.fn().mockResolvedValue(true),
      findWithAuthorizationByHash: jest
        .fn()
        .mockImplementation(async (tokenHash: string) => {
          if (tokenHash === hashToken("refresh")) return { ...refreshRecord };
          return null;
        }),
      rotateRefreshTokens: jest.fn().mockResolvedValue(true),
      revokeTokensIssuedByCode: jest.fn().mockResolvedValue(2),
      revokeToken: jest.fn().mockResolvedValue(true),
      findActiveAccessByHash: jest.fn().mockResolvedValue({
        id: "access-1",
        authorizationId: "authorization-1",
        authorization: {
          userId: "user-1",
          revokedAt: null,
          resource: getMcpResource(),
        },
      }),
      touchLastUsed: jest.fn().mockResolvedValue(true),
    };
    service = new OAuthTokenService(
      codes as never,
      authorizations as never,
      tokens as never,
      {
        findById: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "u@example.com",
          name: "U",
          language: "en",
        }),
      } as never,
      () => new Date(now),
    );
  });

  it("Exchange a valid code for hashed one-hour access and thirty-day refresh tokens", async () => {
    const result = await service.exchangeAuthorizationCode({
      code: "code",
      codeVerifier: verifier,
      clientId: "client-1",
      redirectUri: "https://client.example/cb",
    });
    expect(result).toMatchObject({
      token_type: "Bearer",
      expires_in: OAUTH_ACCESS_TOKEN_TTL_MS / 1000,
    });
    expect(result.access_token).toMatch(/^to_/);
    expect(result.refresh_token).toMatch(/^tr_/);
    expect(tokens.issueCodeTokens).toHaveBeenCalledTimes(1);
    const issuedTokens = tokens.issueCodeTokens.mock.calls[0][3];
    expect(issuedTokens[0].tokenHash).toBe(hashToken(result.access_token));
    expect(issuedTokens[1]).toMatchObject({
      codeId: "code-1",
      expiresAt: new Date(now.getTime() + OAUTH_REFRESH_TOKEN_TTL_MS),
    });
  });

  it("Caps access expiry at the absolute authorization end", async () => {
    const createdAt = new Date(
      now.getTime() - OAUTH_GRANT_MAX_LIFETIME_MS + 30 * 60 * 1000,
    );
    authorizations.findById.mockResolvedValueOnce({
      id: "authorization-1",
      clientId: "client-1",
      userId: "user-1",
      createdAt,
    });

    const result = await service.exchangeAuthorizationCode({
      code: "code",
      codeVerifier: verifier,
      clientId: "client-1",
      redirectUri: "https://client.example/cb",
    });
    const records = tokens.issueCodeTokens.mock.calls[0][3];

    expect(result.expires_in).toBe(1800);
    expect(records[0].expiresAt).toEqual(
      new Date(now.getTime() + 30 * 60 * 1000),
    );
  });

  it("Rejects refresh after the absolute authorization lifetime without rotating", async () => {
    (refreshRecord.authorization as { createdAt: Date }).createdAt = new Date(
      now.getTime() - OAUTH_GRANT_MAX_LIFETIME_MS - 1,
    );

    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    expect(tokens.rotateRefreshTokens).not.toHaveBeenCalled();
  });

  it("Reject a wrong verifier, redirect URI or client with generic invalid_grant", async () => {
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: "b".repeat(43),
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({
      error: "invalid_grant",
      description: "The token grant is invalid.",
    });
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://wrong.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "wrong",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("Reject an expired authorization code", async () => {
    code.expiresAt = now;
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("Reject a malformed verifier, missing code or missing authorization", async () => {
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: "short",
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({
      error: "invalid_request",
      description: expect.not.stringContaining("short"),
    });
    expect(codes.findByHash).not.toHaveBeenCalled();
    codes.findByHash.mockResolvedValueOnce(null);
    await expect(
      service.exchangeAuthorizationCode({
        code: "missing",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    authorizations.findById.mockResolvedValueOnce(null);
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("Revoke tokens issued by a reused authorization code", async () => {
    code.usedAt = new Date(now.getTime() - 1);
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://wrong.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    expect(authorizations.revokeAuthorizationById).toHaveBeenCalledWith(
      "authorization-1",
      now,
    );
  });

  it("Detect concurrent code reuse and revoke any tokens already issued", async () => {
    tokens.issueCodeTokens.mockResolvedValueOnce(false);
    codes.findByHash
      .mockResolvedValueOnce({ ...code })
      .mockResolvedValueOnce({ ...code, usedAt: now });
    await expect(
      service.exchangeAuthorizationCode({
        code: "code",
        codeVerifier: verifier,
        clientId: "client-1",
        redirectUri: "https://client.example/cb",
      }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    expect(authorizations.revokeAuthorizationById).toHaveBeenCalledWith(
      "authorization-1",
      now,
    );
  });

  it("Rotate a valid refresh token and bind its replacements to the parent", async () => {
    const result = await service.refresh({
      refreshToken: "refresh",
      clientId: "client-1",
    });
    expect(result.access_token).toMatch(/^to_/);
    expect(result.refresh_token).toMatch(/^tr_/);
    expect(tokens.rotateRefreshTokens).toHaveBeenCalledWith(
      "refresh-1",
      expect.arrayContaining([
        expect.objectContaining({
          parentTokenId: "refresh-1",
          kind: "refresh",
        }),
      ]),
      now,
    );
  });

  it("Revoke an authorization when a rotated refresh token is reused", async () => {
    refreshRecord.rotatedAt = new Date(now.getTime() - 1000);
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    expect(authorizations.revokeAuthorizationById).toHaveBeenCalledWith(
      "authorization-1",
      now,
    );
  });

  it("Reject unknown, expired, revoked and wrong-client refresh tokens", async () => {
    tokens.findWithAuthorizationByHash.mockResolvedValueOnce(null);
    await expect(
      service.refresh({ refreshToken: "missing", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    refreshRecord.expiresAt = now;
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    refreshRecord.expiresAt = new Date(now.getTime() + 10000);
    refreshRecord.revokedAt = now;
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    refreshRecord.revokedAt = null;
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "wrong" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    (refreshRecord.authorization as { revokedAt: Date | null }).revokedAt = now;
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
  });

  it("Reject a non-refresh token and handle a lost refresh rotation race", async () => {
    tokens.findWithAuthorizationByHash.mockResolvedValueOnce({
      ...refreshRecord,
      kind: "access",
    });
    await expect(
      service.refresh({ refreshToken: "access", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    tokens.rotateRefreshTokens.mockResolvedValueOnce(false);
    tokens.findWithAuthorizationByHash
      .mockResolvedValueOnce({ ...refreshRecord })
      .mockResolvedValueOnce({ ...refreshRecord, rotatedAt: now });
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    expect(authorizations.revokeAuthorizationById).toHaveBeenCalledWith(
      "authorization-1",
      now,
    );
  });

  it("Revoke a refresh token's authorization and silently ignore unknown tokens", async () => {
    await service.revoke({ token: "refresh" });
    expect(authorizations.revokeAuthorizationById).toHaveBeenCalledWith(
      "authorization-1",
      now,
    );
    refreshRecord.revokedAt = now;
    await expect(
      service.refresh({ refreshToken: "refresh", clientId: "client-1" }),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    tokens.findWithAuthorizationByHash.mockResolvedValueOnce(null);
    await expect(service.revoke({ token: "missing" })).resolves.toBeUndefined();
  });

  it("Revoke an access token without revoking its whole authorization", async () => {
    tokens.findWithAuthorizationByHash.mockResolvedValueOnce({
      id: "access-1",
      kind: "access",
      authorizationId: "authorization-1",
    });
    await service.revoke({ token: "access", tokenTypeHint: "access_token" });
    expect(tokens.revokeToken).toHaveBeenCalledWith("access-1", now);
    expect(authorizations.revokeAuthorizationById).not.toHaveBeenCalled();
  });

  it("Ignore revocation requests from a client that does not own the token", async () => {
    await service.revoke({ token: "refresh", clientId: "another-client" });
    await service.revoke({ token: "refresh", clientId: "" });
    expect(authorizations.revokeAuthorizationById).not.toHaveBeenCalled();
    expect(tokens.revokeToken).not.toHaveBeenCalled();
  });

  it("Resolve valid access tokens and reject expired or revoked authorizations", async () => {
    await expect(service.resolveAccessToken("to_valid")).resolves.toMatchObject(
      { id: "user-1" },
    );
    tokens.findActiveAccessByHash.mockResolvedValueOnce(null);
    await expect(
      service.resolveAccessToken("to_expired"),
    ).rejects.toMatchObject({ status: 401 });
    tokens.findActiveAccessByHash.mockResolvedValueOnce({
      authorization: null,
    });
    await expect(
      service.resolveAccessToken("to_revoked"),
    ).rejects.toMatchObject({ status: 401 });
    tokens.findActiveAccessByHash.mockResolvedValueOnce({
      authorization: { userId: "missing" },
    });
    const missingUser = new OAuthTokenService(
      codes as never,
      authorizations as never,
      tokens as never,
      { findById: jest.fn().mockResolvedValue(null) } as never,
      () => new Date(now),
    );
    await expect(
      missingUser.resolveAccessToken("to_deleted-user"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("Reject access tokens bound to a different resource", async () => {
    tokens.findActiveAccessByHash.mockResolvedValueOnce({
      authorization: {
        userId: "user-1",
        revokedAt: null,
        resource: "https://other.example/mcp",
      },
    });
    await expect(
      service.resolveAccessToken("to_wrong-audience"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("Throttle lastUsedAt updates with an injectable clock", async () => {
    tokens.touchLastUsed.mockResolvedValueOnce(false);
    await service.resolveAccessToken("to_valid");
    expect(tokens.touchLastUsed).toHaveBeenCalledWith(
      "access-1",
      now,
      new Date(now.getTime() - 60000),
    );
    expect(authorizations.touchLastUsed).not.toHaveBeenCalled();
  });
});
