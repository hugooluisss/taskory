export const OAUTH_TOKEN_BYTES = 32;
export const OAUTH_VERIFIER_MIN_LENGTH = 43;
export const OAUTH_VERIFIER_MAX_LENGTH = 128;
export const OAUTH_CHALLENGE_LENGTH = 43;
export const OAUTH_REDIRECT_URI_MAX_LENGTH = 2000;
export const OAUTH_PUBLIC_URL_DEFAULT = "http://localhost:3999";
export const OAUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
export const OAUTH_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const OAUTH_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_GRANT_MAX_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
export const OAUTH_ACCESS_TOKEN_PREFIX = "to_";
export const OAUTH_REFRESH_TOKEN_PREFIX = "tr_";
export const OAUTH_CLIENT_NAME_MAX_LENGTH = 100;
export const OAUTH_REDIRECT_URIS_MAX_COUNT = 5;
export const OAUTH_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const OAUTH_UNUSED_CLIENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_DEAD_AUTHORIZATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_LAST_USED_THROTTLE_MS = 60 * 1000;
export const OAUTH_RATE_LIMIT_DEFAULT = 10;
export const OAUTH_RATE_WINDOW_MS_DEFAULT = 60 * 1000;

export function getOauthRateLimit(): number {
  return Number(process.env.OAUTH_RATE_LIMIT ?? OAUTH_RATE_LIMIT_DEFAULT);
}

export function getOauthAuthorizeRateLimit(): number {
  return Number(
    process.env.OAUTH_AUTHORIZE_RATE_LIMIT ?? getOauthRateLimit() * 5,
  );
}

export function getOauthRateWindowMs(): number {
  return Number(
    process.env.OAUTH_RATE_WINDOW_MS ?? OAUTH_RATE_WINDOW_MS_DEFAULT,
  );
}
