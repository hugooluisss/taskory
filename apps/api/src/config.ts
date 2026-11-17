import { getPublicUrl } from "./oauth/public-url";

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
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  getTrustProxyHops();
  getPublicUrl();
}
