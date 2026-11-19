import { createHash } from "node:crypto";
import { OAuthAuthorizationService } from "./oauth-authorization.service";
import { OAUTH_CODE_TTL_MS, OAUTH_REQUEST_TTL_MS } from "./constants";
import { getMcpResource } from "./public-url";

describe("Authorization with PKCE", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let service: OAuthAuthorizationService;
  let clients: { find: jest.Mock };
  let requests: {
    create: jest.Mock;
    find: jest.Mock;
    markDecidedBeforeExpiry: jest.Mock;
    approveRequest: jest.Mock;
  };
  let request: Record<string, unknown>;

  beforeEach(() => {
    request = {
      id: "request-1",
      clientId: "client-1",
      redirectUri: "https://client.example/callback?existing=1",
      codeChallenge: challenge,
      state: "state-1",
      expiresAt: new Date(now.getTime() + OAUTH_REQUEST_TTL_MS),
      decidedAt: null,
    };
    clients = {
      find: jest.fn().mockResolvedValue({
        id: "client-1",
        name: "Client",
        redirectUris: [request.redirectUri],
      }),
    };
    requests = {
      create: jest
        .fn()
        .mockImplementation(async (values) => ({ ...values, id: "request-1" })),
      find: jest.fn().mockImplementation(async () => ({ ...request })),
      markDecidedBeforeExpiry: jest.fn().mockResolvedValue(true),
      approveRequest: jest.fn().mockResolvedValue(undefined),
    };
    service = new OAuthAuthorizationService(
      clients as never,
      requests as never,
      () => new Date(now),
    );
  });

  it("Return an unredirected error for an invalid client or unregistered redirect URI", async () => {
    clients.find.mockResolvedValueOnce(null);
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "missing",
        redirect_uri: "https://evil.example/cb",
      }),
    ).resolves.toMatchObject({
      kind: "error-no-redirect",
      error: "invalid_client",
      errorDescription: "The client identifier is invalid.",
    });
    clients.find.mockResolvedValueOnce({
      id: "client-1",
      redirectUris: ["https://client.example/callback"],
    });
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: "https://evil.example/cb",
      }),
    ).resolves.toMatchObject({
      kind: "error-no-redirect",
      error: "invalid_redirect_uri",
      errorDescription: "The redirect URI is not registered for this client.",
    });
    expect(requests.create).not.toHaveBeenCalled();
  });

  it("Redirect missing or invalid PKCE with an error", async () => {
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
      }),
    ).resolves.toMatchObject({
      kind: "error-redirect",
      error: "invalid_request",
    });
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: "bad",
        code_challenge_method: "plain",
      }),
    ).resolves.toMatchObject({
      kind: "error-redirect",
      error: "invalid_request",
    });
  });

  it("Return a redirect error for an unsupported response type", async () => {
    await expect(
      service.startAuthorization({
        response_type: "token",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    ).resolves.toMatchObject({
      kind: "error-redirect",
      error: "unsupported_response_type",
    });
  });

  it("Require an exact registered redirect URI", async () => {
    clients.find.mockResolvedValue({
      id: "client-1",
      name: "Client",
      redirectUris: ["https://client.example/callback?x=1"],
    });
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: "https://client.example/callback?x=01",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    ).resolves.toMatchObject({
      kind: "error-no-redirect",
      error: "invalid_redirect_uri",
    });
  });

  it("Create an authorization request with the configured request TTL", async () => {
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "state-1",
      }),
    ).resolves.toEqual({ kind: "ok", requestId: "request-1" });
    expect(requests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date(now.getTime() + OAUTH_REQUEST_TTL_MS),
        codeChallenge: challenge,
      }),
    );
  });

  it("Accept a valid request without state", async () => {
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    ).resolves.toMatchObject({ kind: "ok" });
    expect(requests.create).toHaveBeenCalledWith(
      expect.objectContaining({ state: null }),
    );
  });

  it("Reject unknown, expired and decided consent requests", async () => {
    requests.find.mockResolvedValueOnce(null);
    await expect(service.getConsentRequest("missing")).rejects.toMatchObject({
      reason: "not_found",
    });
    requests.find.mockResolvedValueOnce({ ...request, expiresAt: now });
    await expect(service.getConsentRequest("expired")).rejects.toMatchObject({
      reason: "expired",
    });
    requests.find.mockResolvedValueOnce({ ...request, decidedAt: now });
    await expect(service.getConsentRequest("decided")).rejects.toMatchObject({
      reason: "already_decided",
    });
  });

  it("Show the registered client and custom scheme on the consent screen", async () => {
    request.redirectUri = "myapp.example://callback/path";
    clients.find.mockResolvedValue({
      id: "client-1",
      name: "Client",
      redirectUris: [request.redirectUri],
    });
    await expect(service.getConsentRequest("request-1")).resolves.toMatchObject(
      {
        clientName: "Client",
        clientId: "client-1",
        redirectUri: "myapp.example://callback/path",
        redirectHost: "myapp.example",
      },
    );
  });

  it("Show the redirect host for an HTTPS callback", async () => {
    await expect(service.getConsentRequest("request-1")).resolves.toMatchObject(
      {
        redirectHost: "client.example",
        redirectUri: "https://client.example/callback?existing=1",
      },
    );
  });

  it("Approve with a single-use code expiring in ten minutes", async () => {
    const result = await service.decide("request-1", "user-1", true);
    const redirect = new URL(result.redirectUrl);
    expect(redirect.searchParams.get("state")).toBe("state-1");
    expect(redirect.searchParams.get("code")).toBeTruthy();
    expect(requests.approveRequest).toHaveBeenCalledWith(
      "request-1",
      "user-1",
      "client-1",
      request.redirectUri,
      challenge,
      expect.any(String),
      now,
      new Date(now.getTime() + OAUTH_CODE_TTL_MS),
      getMcpResource(),
    );
    expect(
      requests.approveRequest.mock.calls[0][0] ===
        redirect.searchParams.get("code"),
    ).toBe(false);
    expect(requests.markDecidedBeforeExpiry).not.toHaveBeenCalled();
  });

  it("Deny consent with access_denied and the original state", async () => {
    const result = await service.decide("request-1", "user-1", false);
    const redirect = new URL(result.redirectUrl);
    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("state")).toBe("state-1");
    expect(requests.approveRequest).not.toHaveBeenCalled();
  });

  it("Encode state with URLSearchParams without injecting callback parameters", async () => {
    request.state = "first&code=forged#fragment";
    const result = await service.decide("request-1", "user-1", false);
    const redirect = new URL(result.redirectUrl);
    expect(redirect.searchParams.get("state")).toBe(request.state);
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(redirect.hash).toBe("");
  });

  it("Preserve an empty state and omit a missing state on denial", async () => {
    request.state = null;
    const result = await service.decide("request-1", "user-1", false);
    expect(new URL(result.redirectUrl).searchParams.has("state")).toBe(false);
  });

  it("Reject decision requests that are unknown, expired or already decided", async () => {
    requests.find.mockResolvedValueOnce(null);
    await expect(
      service.decide("missing", "user-1", false),
    ).rejects.toMatchObject({ reason: "not_found" });
    requests.find.mockResolvedValueOnce({ ...request, expiresAt: now });
    await expect(
      service.decide("expired", "user-1", false),
    ).rejects.toMatchObject({ reason: "expired" });
    requests.find.mockResolvedValueOnce({ ...request, decidedAt: now });
    await expect(
      service.decide("decided", "user-1", false),
    ).rejects.toMatchObject({ reason: "already_decided" });
  });

  it("Reject a decision if another request already decided or it expired", async () => {
    requests.markDecidedBeforeExpiry.mockResolvedValue(false);
    requests.find
      .mockResolvedValueOnce({ ...request })
      .mockResolvedValueOnce({ ...request, decidedAt: now });
    await expect(
      service.decide("request-1", "user-1", false),
    ).rejects.toMatchObject({ reason: "already_decided" });
    requests.find
      .mockResolvedValueOnce({ ...request })
      .mockResolvedValueOnce({ ...request, decidedAt: null });
    await expect(
      service.decide("request-1", "user-1", false),
    ).rejects.toMatchObject({ reason: "expired" });
  });

  it("Treat a request as expired exactly at expiresAt", async () => {
    request.expiresAt = now;
    await expect(
      service.decide("request-1", "user-1", true),
    ).rejects.toMatchObject({ reason: "expired" });
    expect(requests.markDecidedBeforeExpiry).not.toHaveBeenCalled();
  });

  it("Issue only one code for two concurrent approval decisions", async () => {
    let decided = false;
    requests.find.mockImplementation(async () => ({
      ...request,
      decidedAt: decided ? now : null,
    }));
    requests.approveRequest.mockImplementation(async () => {
      if (decided) throw new Error("already_decided");
      decided = true;
    });
    const results = await Promise.allSettled([
      service.decide("request-1", "user-1", true),
      service.decide("request-1", "user-1", true),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(requests.approveRequest).toHaveBeenCalledTimes(2);
  });

  it("Reject consent lookup or decision if the registered client was removed", async () => {
    clients.find.mockResolvedValueOnce(null);
    await expect(service.getConsentRequest("request-1")).rejects.toMatchObject({
      reason: "not_found",
    });
    clients.find.mockResolvedValueOnce(null);
    await expect(
      service.decide("request-1", "user-1", false),
    ).rejects.toMatchObject({ reason: "not_found" });
  });

  it("Allow a consent request to be decided only once", async () => {
    await service.decide("request-1", "user-1", false);
    request.decidedAt = now;
    await expect(
      service.decide("request-1", "user-1", true),
    ).rejects.toMatchObject({ reason: "already_decided" });
  });

  it("Reject an unsupported resource or scope with a redirect error", async () => {
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: "https://other.example/mcp",
        state: "resource-state",
      }),
    ).resolves.toMatchObject({
      kind: "error-redirect",
      error: "invalid_target",
      state: "resource-state",
    });
    await expect(
      service.startAuthorization({
        response_type: "code",
        client_id: "client-1",
        redirect_uri: request.redirectUri as string,
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope: "taskory profile",
        state: "scope-state",
      }),
    ).resolves.toMatchObject({
      kind: "error-redirect",
      error: "invalid_scope",
      state: "scope-state",
    });
  });

  it("Return the full access consent contract", async () => {
    await expect(service.getConsentRequest("request-1")).resolves.toMatchObject(
      {
        clientId: "client-1",
        scope: "taskory",
        accessDescription: "full-access",
      },
    );
  });
});
