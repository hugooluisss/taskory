import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { bearerToken } from "../src/http/bearer-auth.js";
import { calendarDate } from "../src/tools/validation.js";
import { bearerToken as toolBearerToken } from "../src/tools/token.js";

function requestWithAuthorization(authorization: string): IncomingMessage {
  return { headers: { authorization } } as IncomingMessage;
}

describe("Configuration validation", () => {
  it("Uses the documented defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 3100,
      taskoryApiUrl: "http://localhost:3999/api/v1",
      publicUrl: "http://localhost:3999",
    });
  });

  it("Rejects a port outside the valid range", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow("PORT");
  });

  it("Rejects non-HTTP URL schemes", () => {
    expect(() => loadConfig({ PUBLIC_URL: "file:///tmp" })).toThrow(
      "PUBLIC_URL",
    );
    expect(() => loadConfig({ TASKORY_API_URL: "ftp://api.test/v1" })).toThrow(
      "TASKORY_API_URL",
    );
  });

  it("Normalizes trailing slashes from the API URL", () => {
    expect(
      loadConfig({
        TASKORY_API_URL: "https://api.test/api/v1///",
        PUBLIC_URL: "https://taskory.test/",
      }),
    ).toEqual({
      port: 3100,
      taskoryApiUrl: "https://api.test/api/v1",
      publicUrl: "https://taskory.test",
    });
  });

  it("Rejects a public URL containing a path", () => {
    expect(() =>
      loadConfig({ PUBLIC_URL: "https://taskory.test/path" }),
    ).toThrow("PUBLIC_URL");
  });
});

describe("Bearer authorization parsing", () => {
  it("Accepts the Bearer scheme without case sensitivity", () => {
    expect(bearerToken(requestWithAuthorization("bEaReR token"))).toBe("token");
  });

  it("Rejects more than one space after the scheme", () => {
    expect(
      bearerToken(requestWithAuthorization("Bearer  token")),
    ).toBeUndefined();
  });

  it("Rejects tokens containing whitespace", () => {
    expect(
      bearerToken(requestWithAuthorization("Bearer token value")),
    ).toBeUndefined();
    expect(
      bearerToken(requestWithAuthorization("Bearer token\n")),
    ).toBeUndefined();
  });

  it("Rejects tokens longer than 512 characters", () => {
    expect(
      bearerToken(requestWithAuthorization(`Bearer ${"x".repeat(513)}`)),
    ).toBeUndefined();
  });

  it("Accepts a token of 512 characters", () => {
    expect(
      bearerToken(requestWithAuthorization(`Bearer ${"x".repeat(512)}`)),
    ).toHaveLength(512);
  });

  it("Rejects a non-Bearer scheme", () => {
    expect(
      bearerToken(requestWithAuthorization("Basic token")),
    ).toBeUndefined();
  });
});

describe("Tool input validation", () => {
  it("Accepts YYYY-MM-DD format and leaves calendar validity to the API", () => {
    expect(calendarDate.safeParse("2024-02-29").success).toBe(true);
    expect(calendarDate.safeParse("2026-02-30").success).toBe(true);
    expect(calendarDate.safeParse("2026-2-3").success).toBe(false);
  });
});

describe("Tool bearer extraction", () => {
  it("Returns an empty token when request authorization is missing", () => {
    expect(toolBearerToken({ requestInfo: { headers: {} } })).toBe("");
  });

  it("Returns an empty token when authorization is not a string", () => {
    expect(
      toolBearerToken({
        requestInfo: { headers: { authorization: ["Bearer", "token"] } },
      }),
    ).toBe("");
  });
});
