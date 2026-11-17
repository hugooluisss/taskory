import { Inject, Injectable } from "@nestjs/common";
import { OAUTH_CODE_TTL_MS, OAUTH_REQUEST_TTL_MS } from "./constants";
import { OAuthAuthorizationRequestsRepository } from "./oauth-authorization-requests.repository";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { OAuthRequestNotFoundError } from "./oauth-domain.error";
import { OAuthErrorCode } from "./oauth-error";
import { OAuthNow, OAUTH_NOW } from "./oauth-clock";
import { OAuthAuthorizationRequest } from "./entities/oauth-authorization-request.entity";
import { OAuthClient } from "./entities/oauth-client.entity";
import { generateToken, hashToken } from "./token-hasher";
import { isValidChallenge } from "./pkce";
import { matchesRegisteredRedirect } from "./redirect-uri.validator";
import { getMcpResource, getPublicUrl } from "./public-url";

export interface StartAuthorizationParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  resource?: string;
  scope?: string;
}

export type StartAuthorizationResult =
  | {
      kind: "error-no-redirect";
      error: OAuthErrorCode;
      errorDescription: string;
      state?: string;
    }
  | {
      kind: "error-redirect";
      redirectUri: string;
      error: OAuthErrorCode;
      state?: string;
    }
  | {
      kind: "ok";
      requestId: string;
    };

@Injectable()
export class OAuthAuthorizationService {
  constructor(
    private readonly clients: OAuthClientsRepository,
    private readonly requests: OAuthAuthorizationRequestsRepository,
    @Inject(OAUTH_NOW) private readonly now: OAuthNow,
  ) {}

  async startAuthorization(
    params: StartAuthorizationParams,
  ): Promise<StartAuthorizationResult> {
    const clientOrError = await this.validateStartParams(params);
    if ("kind" in clientOrError) return clientOrError;
    const now = this.now();
    const request = await this.requests.create({
      clientId: clientOrError.id,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge!,
      state: params.state ?? null,
      expiresAt: new Date(now.getTime() + OAUTH_REQUEST_TTL_MS),
    });
    return { kind: "ok", requestId: request.id };
  }

  private async validateStartParams(
    params: StartAuthorizationParams,
  ): Promise<OAuthClient | StartAuthorizationResult> {
    const client = await this.clients.find(params.client_id);
    if (!client) {
      return {
        kind: "error-no-redirect",
        error: "invalid_client",
        errorDescription: "The client identifier is invalid.",
        state: params.state,
      };
    }
    if (!matchesRegisteredRedirect(client.redirectUris, params.redirect_uri)) {
      return {
        kind: "error-no-redirect",
        error: "invalid_redirect_uri",
        errorDescription: "The redirect URI is not registered for this client.",
        state: params.state,
      };
    }
    if (params.resource !== undefined && params.resource !== getMcpResource()) {
      return this.redirectError(params, "invalid_target");
    }
    const scopes = params.scope?.split(/\s+/).filter(Boolean);
    if (
      params.scope !== undefined &&
      (!scopes?.length || scopes.some((scope) => scope !== "taskory"))
    ) {
      return this.redirectError(params, "invalid_scope");
    }
    return this.responseTypeError(params) ?? client;
  }

  private redirectError(
    params: StartAuthorizationParams,
    error: OAuthErrorCode,
  ): StartAuthorizationResult {
    return {
      kind: "error-redirect",
      redirectUri: params.redirect_uri,
      error,
      state: params.state,
    };
  }

  private responseTypeError(
    params: StartAuthorizationParams,
  ): StartAuthorizationResult | null {
    let error: OAuthErrorCode | undefined;
    if (params.response_type !== "code") error = "unsupported_response_type";
    else if (
      params.code_challenge_method !== "S256" ||
      !params.code_challenge ||
      !isValidChallenge(params.code_challenge)
    ) {
      error = "invalid_request";
    }
    if (error) {
      return {
        kind: "error-redirect",
        redirectUri: params.redirect_uri,
        error,
        state: params.state,
      };
    }
    return null;
  }

  async getConsentRequest(requestId: string): Promise<{
    clientName: string;
    clientId: string;
    redirectUri: string;
    redirectHost: string;
    scope: "taskory";
    accessDescription: "full-access";
    expiresAt: Date;
  }> {
    const request = await this.requests.find(requestId);
    if (!request) throw new OAuthRequestNotFoundError("not_found");
    if (request.expiresAt <= this.now())
      throw new OAuthRequestNotFoundError("expired");
    if (request.decidedAt)
      throw new OAuthRequestNotFoundError("already_decided");
    const client = await this.clients.find(request.clientId);
    if (!client) throw new OAuthRequestNotFoundError("not_found");
    return {
      clientName: client.name,
      clientId: client.id,
      redirectUri: request.redirectUri,
      redirectHost: redirectHost(request.redirectUri),
      scope: "taskory",
      accessDescription: "full-access",
      expiresAt: request.expiresAt,
    };
  }

  async decide(
    requestId: string,
    userId: string,
    approve: boolean,
  ): Promise<{ redirectUrl: string }> {
    const request = await this.loadPendingRequest(requestId);
    const client = await this.clients.find(request.clientId);
    if (!client) throw new OAuthRequestNotFoundError("not_found");
    if (!approve) {
      await this.claimRequest(requestId);
      return this.deny(request);
    }
    return this.approve(request, userId);
  }

  private async loadPendingRequest(
    requestId: string,
  ): Promise<OAuthAuthorizationRequest> {
    const request = await this.requests.find(requestId);
    if (!request) throw new OAuthRequestNotFoundError("not_found");
    if (request.expiresAt <= this.now())
      throw new OAuthRequestNotFoundError("expired");
    if (request.decidedAt)
      throw new OAuthRequestNotFoundError("already_decided");
    return request;
  }

  private async claimRequest(
    requestId: string,
  ): Promise<OAuthAuthorizationRequest> {
    const request = await this.loadPendingRequest(requestId);
    const now = this.now();
    const decided = await this.requests.markDecidedBeforeExpiry(requestId, now);
    if (decided) return request;
    const latest = await this.requests.find(requestId);
    throw new OAuthRequestNotFoundError(
      latest?.decidedAt ? "already_decided" : "expired",
    );
  }

  private deny(request: OAuthAuthorizationRequest): { redirectUrl: string } {
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    if (request.state !== null)
      redirect.searchParams.set("state", request.state);
    redirect.searchParams.set("iss", getPublicUrl());
    return { redirectUrl: redirect.toString() };
  }

  private async approve(
    request: OAuthAuthorizationRequest,
    userId: string,
  ): Promise<{ redirectUrl: string }> {
    const now = this.now();
    const code = generateToken("");
    await this.requests.approveRequest(
      request.id,
      userId,
      request.clientId,
      request.redirectUri,
      request.codeChallenge,
      hashToken(code),
      now,
      new Date(now.getTime() + OAUTH_CODE_TTL_MS),
      getMcpResource(),
    );
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("code", code);
    if (request.state !== null)
      redirect.searchParams.set("state", request.state);
    redirect.searchParams.set("iss", getPublicUrl());
    return { redirectUrl: redirect.toString() };
  }
}

function redirectHost(uri: string): string {
  const parsed = new URL(uri);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return parsed.protocol.slice(0, -1);
  }
  return parsed.host;
}
