import { Injectable } from "@nestjs/common";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { PublicUser } from "./public-user";
import { AuthService } from "./auth.service";
import { Inject } from "@nestjs/common";
import {
  OAUTH_TOKEN_RESOLVER,
  OAuthTokenResolver,
} from "../oauth/oauth-token-resolver";

@Injectable()
export class TokenAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
    @Inject(OAUTH_TOKEN_RESOLVER) private readonly oauth: OAuthTokenResolver,
  ) {}

  authenticate(token: string): Promise<PublicUser> {
    if (token.startsWith("tk_")) {
      return this.apiKeys.authenticate(token);
    }
    if (token.startsWith("to_")) {
      return this.oauth.resolveAccessToken(token);
    }
    return this.auth.authenticate(token);
  }
}
