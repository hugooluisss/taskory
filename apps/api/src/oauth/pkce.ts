import { createHash, timingSafeEqual } from "node:crypto";
import {
  OAUTH_CHALLENGE_LENGTH,
  OAUTH_VERIFIER_MAX_LENGTH,
  OAUTH_VERIFIER_MIN_LENGTH,
} from "./constants";

export function isValidVerifier(verifier: string): boolean {
  return new RegExp(
    `^[A-Za-z0-9\-._~]{${OAUTH_VERIFIER_MIN_LENGTH},${OAUTH_VERIFIER_MAX_LENGTH}}$`,
  ).test(verifier);
}

export function isValidChallenge(challenge: string): boolean {
  return new RegExp(`^[A-Za-z0-9_-]{${OAUTH_CHALLENGE_LENGTH}}$`).test(
    challenge,
  );
}

export function verifyS256(verifier: string, challenge: string): boolean {
  const expected = Buffer.from(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
