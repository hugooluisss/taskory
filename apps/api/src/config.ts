import { getMcpPath, getPublicUrl } from "./oauth/public-url";

export function getTrustProxyHops(): number {
  const value = process.env.TRUST_PROXY_HOPS;
  if (value === undefined) return 0;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(
      "TRUST_PROXY_HOPS must be an integer greater than or equal to 0",
    );
  }
  return Number(value);
}

export function validateConfig(): void {
  for (const name of [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
  ]) {
    if (!process.env[name])
      throw new Error(`${name} is required for MySQL connection`);
  }
  if (
    !/^\d+$/.test(process.env.DB_PORT!) ||
    Number(process.env.DB_PORT) < 1 ||
    Number(process.env.DB_PORT) > 65535
  ) {
    throw new Error("DB_PORT must be an integer between 1 and 65535");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  getTrustProxyHops();
  getPublicUrl();
  getMcpPath();
}
