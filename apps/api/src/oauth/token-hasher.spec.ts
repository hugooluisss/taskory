import { generateToken, hashToken } from "./token-hasher";

describe("Opaque token hashing", () => {
  it("Hashes tokens as SHA-256 hex and generates prefixed 32-byte tokens", () => {
    const token = generateToken("to_");
    expect(token).toMatch(/^to_[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});
