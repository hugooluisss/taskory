import { createHash, randomBytes } from "node:crypto";
import { OAUTH_TOKEN_BYTES } from "./constants";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(prefix: string): string {
  return prefix + randomBytes(OAUTH_TOKEN_BYTES).toString("base64url");
}
