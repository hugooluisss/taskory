import { PublicUser } from "../auth/public-user";

export const OAUTH_TOKEN_RESOLVER = Symbol("OAUTH_TOKEN_RESOLVER");

export interface OAuthTokenResolver {
  resolveAccessToken(rawToken: string): Promise<PublicUser>;
}
