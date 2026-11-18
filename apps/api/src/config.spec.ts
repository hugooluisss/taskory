import { getTrustProxyHops, validateConfig } from "./config";

const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  PUBLIC_URL: process.env.PUBLIC_URL,
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,
  MCP_PATH: process.env.MCP_PATH,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("MySQL configuration", () => {
  it("requires DB environment settings", () => {
    for (const key of [
      "DB_HOST",
      "DB_PORT",
      "DB_NAME",
      "DB_USER",
      "DB_PASSWORD",
    ])
      delete process.env[key];
    expect(() => validateConfig()).toThrow(
      "DB_HOST is required for MySQL connection",
    );
  });
  it("rejects an invalid port", () => {
    Object.assign(process.env, {
      DB_HOST: "localhost",
      DB_PORT: "no",
      DB_NAME: "x",
      DB_USER: "x",
      DB_PASSWORD: "x",
      JWT_SECRET: "x",
      PUBLIC_URL: "https://example.test",
    });
    expect(() => validateConfig()).toThrow(
      "DB_PORT must be an integer between 1 and 65535",
    );
  });
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
