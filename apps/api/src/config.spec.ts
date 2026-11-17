import { getTrustProxyHops, validateConfig } from "./config";

const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  PUBLIC_URL: process.env.PUBLIC_URL,
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,
  MCP_PATH: process.env.MCP_PATH,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("TRUST_PROXY_HOPS", () => {
  it("defaults to zero", () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(getTrustProxyHops()).toBe(0);
  });

  it("accepts a non-negative integer", () => {
    process.env.TRUST_PROXY_HOPS = "2";
    expect(getTrustProxyHops()).toBe(2);
  });

  it("fails startup with a clear error for an invalid value", () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.PUBLIC_URL = "https://taskory.example";
    process.env.TRUST_PROXY_HOPS = "1.5";
    expect(() => validateConfig()).toThrow(
      "TRUST_PROXY_HOPS must be an integer greater than or equal to 0",
    );
  });

  it("fails startup with a clear error for an invalid MCP path", () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.PUBLIC_URL = "https://taskory.example";
    process.env.MCP_PATH = "/mcp/";
    expect(() => validateConfig()).toThrow("MCP_PATH");
  });
});
