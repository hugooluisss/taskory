export const AUTH_TOKEN_EXPIRY = "1h";
export const AUTH_RATE_LIMIT_DEFAULT = 10;
export const AUTH_RATE_WINDOW_MS_DEFAULT = 60000;

export function authRateLimit(): number {
  return Number(process.env.AUTH_RATE_LIMIT ?? AUTH_RATE_LIMIT_DEFAULT);
}

export function authRateWindowMs(): number {
  return Number(process.env.AUTH_RATE_WINDOW_MS ?? AUTH_RATE_WINDOW_MS_DEFAULT);
}
