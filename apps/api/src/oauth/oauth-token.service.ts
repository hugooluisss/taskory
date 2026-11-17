import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { PublicUser } from "../auth/public-user";
import { UsersService } from "../users/users.service";
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_LAST_USED_THROTTLE_MS,
  OAUTH_GRANT_MAX_LIFETIME_MS,
  OAUTH_REFRESH_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_TTL_MS,
} from "./constants";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { OAuthAuthorizationCodesRepository } from "./oauth-authorization-codes.repository";
import { OAuthAuthorizationsRepository } from "./oauth-authorizations.repository";
import { OAuthTokensRepository } from "./oauth-tokens.repository";
import { OAuthError } from "./oauth-error";
import { OAuthNow, OAUTH_NOW } from "./oauth-clock";
import { generateToken, hashToken } from "./token-hasher";
import { isValidVerifier, verifyS256 } from "./pkce";
import { getMcpResource } from "./public-url";

const INVALID_GRANT_DESCRIPTION = "The token grant is invalid.";
const INVALID_REQUEST_DESCRIPTION = "The authorization request is invalid.";

type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
};

type TokenPair = {
  response: TokenResponse;
  records: Array<
    Pick<
      OAuthToken,
      | "authorizationId"
      | "kind"
      | "tokenHash"
      | "expiresAt"
      | "parentTokenId"
      | "codeId"
    >
  >;
};

@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(
    private readonly codes: OAuthAuthorizationCodesRepository,
    private readonly authorizations: OAuthAuthorizationsRepository,
    private readonly tokens: OAuthTokensRepository,
    private readonly users: UsersService,
    @Inject(OAUTH_NOW) private readonly now: OAuthNow,
  ) {}

  async exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
    resource?: string;
  }): Promise<TokenResponse> {
    this.assertResource(input.resource);
    if (!isValidVerifier(input.codeVerifier)) {
      throw new OAuthError("invalid_request", INVALID_REQUEST_DESCRIPTION, 400);
    }
    const now = this.now();
    const loaded = await this.loadValidCode(input.code, input.clientId);
    await this.assertCodeUsable(
      loaded.code,
      input.redirectUri,
      input.codeVerifier,
      now,
    );
    const grantEnd = new Date(
      loaded.authorization.createdAt.getTime() + OAUTH_GRANT_MAX_LIFETIME_MS,
    );
    const pair = this.createTokenPair(
      loaded.authorization.id,
      loaded.code.id,
      null,
      now,
      grantEnd,
    );
    const issued = await this.tokens.issueCodeTokens(
      loaded.code.id,
      now,
      getMcpResource(),
      pair.records,
    );
    if (!issued)
      await this.handleCodeIssueRace(loaded.code, loaded.authorization.id);
    return pair.response;
  }

  async refresh(input: {
    refreshToken: string;
    clientId: string;
    resource?: string;
  }): Promise<TokenResponse> {
    this.assertResource(input.resource);
    const now = this.now();
    const token = await this.loadValidRefresh(
      input.refreshToken,
      input.clientId,
      now,
    );
    const grantEnd = new Date(
      token.authorization!.createdAt.getTime() + OAUTH_GRANT_MAX_LIFETIME_MS,
    );
    if (now.getTime() > grantEnd.getTime()) {
      this.logger.warn(
        `Refresh rejected for expired authorization ${token.authorizationId}.`,
      );
      throw invalidGrant();
    }
    const pair = this.createTokenPair(
      token.authorizationId,
      null,
      token.id,
      now,
      grantEnd,
    );
    const rotated = await this.tokens.rotateRefreshTokens(
      token.id,
      pair.records,
      now,
    );
    if (!rotated)
      await this.handleRefreshRotationRace(
        input.refreshToken,
        token.authorizationId,
        now,
      );
    return pair.response;
  }

  async revoke(input: {
    token: string;
    tokenTypeHint?: string;
    clientId?: string;
  }): Promise<void> {
    const token = await this.tokens.findWithAuthorizationByHash(
      hashToken(input.token),
    );
    if (!token) return;
    if (
      input.clientId !== undefined &&
      token.authorization?.clientId !== input.clientId
    )
      return;
    const now = this.now();
    if (token.kind === "refresh") {
      await this.revokeAuthorization(token.authorizationId, now);
      return;
    }
    await this.tokens.revokeToken(token.id, now);
  }

  async resolveAccessToken(rawToken: string): Promise<PublicUser> {
    const now = this.now();
    const token = await this.tokens.findActiveAccessByHash(
      hashToken(rawToken),
      now,
    );
    if (
      !token?.authorization ||
      token.authorization.resource !== getMcpResource()
    ) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    await this.touchLastUsed(token, now);
    return this.findPublicUser(token.authorization.userId);
  }

  private assertResource(resource?: string): void {
    if (resource !== undefined && resource !== getMcpResource()) {
      throw new OAuthError("invalid_target", "The resource is invalid.", 400);
    }
  }

  private async loadValidCode(
    rawCode: string,
    clientId: string,
  ): Promise<{
    code: OAuthAuthorizationCode;
    authorization: OAuthAuthorization;
  }> {
    const code = await this.codes.findByHash(hashToken(rawCode));
    if (!code) throw invalidGrant();
    const authorization = await this.authorizations.findById(
      code.authorizationId,
    );
    if (!authorization || authorization.clientId !== clientId)
      throw invalidGrant();
    return { code, authorization };
  }

  private async assertCodeUsable(
    code: OAuthAuthorizationCode,
    redirectUri: string,
    verifier: string,
    now: Date,
  ): Promise<void> {
    if (code.usedAt) await this.handleCodeReuse(code);
    if (code.redirectUri !== redirectUri || code.expiresAt <= now)
      throw invalidGrant();
    if (!verifyS256(verifier, code.codeChallenge)) throw invalidGrant();
  }

  private async handleCodeReuse(code: OAuthAuthorizationCode): Promise<never> {
    await this.revokeAuthorization(code.authorizationId, this.now());
    this.logger.warn(
      `Reused authorization code for authorization ${code.authorizationId}.`,
    );
    throw invalidGrant();
  }

  private async handleCodeIssueRace(
    code: OAuthAuthorizationCode,
    authorizationId: string,
  ): Promise<never> {
    const latest = await this.codes.findByHash(code.codeHash);
    if (latest?.usedAt) {
      await this.revokeAuthorization(authorizationId, this.now());
      this.logger.warn(
        `Reused authorization code for authorization ${authorizationId}.`,
      );
    }
    throw invalidGrant();
  }

  private async loadValidRefresh(
    rawToken: string,
    clientId: string,
    now: Date,
  ): Promise<OAuthToken> {
    const token = await this.tokens.findWithAuthorizationByHash(
      hashToken(rawToken),
    );
    if (!token || token.kind !== "refresh") throw invalidGrant();
    if (token.rotatedAt)
      await this.handleRefreshReuse(token.authorizationId, now);
    if (
      token.expiresAt <= now ||
      token.revokedAt ||
      !token.authorization ||
      token.authorization.resource !== getMcpResource() ||
      token.authorization.revokedAt ||
      token.authorization.clientId !== clientId
    ) {
      throw invalidGrant();
    }
    return token;
  }

  private async handleRefreshRotationRace(
    rawToken: string,
    authorizationId: string,
    now: Date,
  ): Promise<never> {
    const latest = await this.tokens.findWithAuthorizationByHash(
      hashToken(rawToken),
    );
    if (latest?.rotatedAt) await this.handleRefreshReuse(authorizationId, now);
    throw invalidGrant();
  }

  private async handleRefreshReuse(
    authorizationId: string,
    now: Date,
  ): Promise<never> {
    await this.revokeAuthorization(authorizationId, now);
    this.logger.warn(
      `Reused refresh token for authorization ${authorizationId}.`,
    );
    throw invalidGrant();
  }

  private createTokenPair(
    authorizationId: string,
    codeId: string | null,
    parentTokenId: string | null,
    now: Date,
    grantEnd?: Date,
  ): TokenPair {
    const accessToken = generateToken(OAUTH_ACCESS_TOKEN_PREFIX);
    const refreshToken = generateToken(OAUTH_REFRESH_TOKEN_PREFIX);
    return {
      response: buildTokenResponse(accessToken, refreshToken, now, grantEnd),
      records: [
        tokenRecord(
          authorizationId,
          "access",
          accessToken,
          now,
          parentTokenId,
          codeId,
          grantEnd,
        ),
        tokenRecord(
          authorizationId,
          "refresh",
          refreshToken,
          now,
          parentTokenId,
          codeId,
        ),
      ],
    };
  }

  private async touchLastUsed(token: OAuthToken, now: Date): Promise<void> {
    const threshold = new Date(now.getTime() - OAUTH_LAST_USED_THROTTLE_MS);
    const touched = await this.tokens.touchLastUsed(token.id, now, threshold);
    if (touched)
      await this.authorizations.touchLastUsed(
        token.authorizationId,
        now,
        threshold,
      );
  }

  private async findPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      language: user.language,
    };
  }

  private async revokeAuthorization(id: string, at: Date): Promise<void> {
    await this.authorizations.revokeAuthorizationById(id, at);
  }
}

function tokenRecord(
  authorizationId: string,
  kind: "access" | "refresh",
  rawToken: string,
  now: Date,
  parentTokenId: string | null,
  codeId: string | null,
  grantEnd?: Date,
): TokenPair["records"][number] {
  const ttl =
    kind === "access" ? OAUTH_ACCESS_TOKEN_TTL_MS : OAUTH_REFRESH_TOKEN_TTL_MS;
  return {
    authorizationId,
    kind,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(
      Math.min(
        now.getTime() + ttl,
        kind === "access" && grantEnd ? grantEnd.getTime() : Infinity,
      ),
    ),
    parentTokenId,
    codeId,
  };
}

function buildTokenResponse(
  accessToken: string,
  refreshToken: string,
  now: Date,
  grantEnd?: Date,
): TokenResponse {
  const expiresIn = grantEnd
    ? Math.max(
        0,
        Math.floor(
          (Math.min(
            now.getTime() + OAUTH_ACCESS_TOKEN_TTL_MS,
            grantEnd.getTime(),
          ) -
            now.getTime()) /
            1000,
        ),
      )
    : OAUTH_ACCESS_TOKEN_TTL_MS / 1000;
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
  };
}

function invalidGrant(): OAuthError {
  return new OAuthError("invalid_grant", INVALID_GRANT_DESCRIPTION, 400);
}
