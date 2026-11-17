import { createHash } from "node:crypto";
import { isValidChallenge, isValidVerifier, verifyS256 } from "./pkce";

describe("PKCE S256", () => {
  const verifier = "A".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("Accepts a verifier and matching S256 challenge", () => {
    expect(isValidVerifier(verifier)).toBe(true);
    expect(isValidChallenge(challenge)).toBe(true);
    expect(verifyS256(verifier, challenge)).toBe(true);
  });

  it("Rejects invalid verifier lengths and characters", () => {
    expect(isValidVerifier("a".repeat(42))).toBe(false);
    expect(isValidVerifier("a".repeat(129))).toBe(false);
    expect(isValidVerifier("a".repeat(42) + " ")).toBe(false);
  });

  it("Rejects invalid challenges and mismatched verifiers", () => {
    expect(isValidChallenge("a".repeat(42))).toBe(false);
    expect(verifyS256("B".repeat(43), challenge)).toBe(false);
    expect(verifyS256(verifier, "short")).toBe(false);
  });
});
