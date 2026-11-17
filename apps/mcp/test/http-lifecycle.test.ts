import { describe, expect, it, vi } from "vitest";
import { createHttpServer } from "../src/http/server.js";
import { listen } from "./support/mcp-system.js";
import { defaultFakeTaskoryHandler } from "./support/fake-taskory-api.js";
import { contentText, withMcpClient } from "./support/mcp-system.js";
import { withMcpSystem } from "./support/mcp-system.js";

describe("Stateless streamable HTTP", () => {
  it("Handles two sequential /mcp requests without a 500 response", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "sequential-token",
      async ({ client }) => {
        const first = await client.callTool({
          name: "list_activities",
          arguments: {},
        });
        const second = await client.callTool({
          name: "list_activities",
          arguments: {},
        });
        expect(first.isError).not.toBe(true);
        expect(second.isError).not.toBe(true);
        expect(contentText(second)).toContain('"total":0');
      },
    );
  });

  it("Does not write the bearer token to logs", async () => {
    const token = "secret-token-never-log";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await withMcpClient(
        defaultFakeTaskoryHandler,
        token,
        async ({ client }) => {
          await client.callTool({ name: "list_activities", arguments: {} });
        },
      );
      const output = [log.mock.calls, warn.mock.calls, error.mock.calls]
        .flat(2)
        .join(" ");
      expect(output).not.toContain(token);
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

describe("MCP endpoint and authentication", () => {
  it("Malformed JSON-RPC returns HTTP 400 and JSON-RPC -32700", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/mcp`, {
        method: "POST",
        headers: {
          authorization: "Bearer malformed-token",
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: "{",
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("-32700");
    });
  });

  it("Oversized request body returns HTTP 413", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/mcp`, {
        method: "POST",
        headers: {
          authorization: "Bearer large-token",
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 1,
          payload: "x".repeat(4 * 1024 * 1024),
        }),
      });
      expect(response.status).toBe(413);
    });
  });
});

describe("Stateless streamable HTTP", () => {
  it("Closes cleanly when the client disconnects during token validation", async () => {
    let validationStarted!: () => void;
    let finishValidation!: () => void;
    const started = new Promise<void>((resolve) => {
      validationStarted = resolve;
    });
    const validation = new Promise<void>((resolve) => {
      finishValidation = resolve;
    });
    const server = createHttpServer({
      port: 0,
      taskoryApiUrl: "http://api.test/api/v1",
      publicUrl: "https://taskory.test",
      fetcher: async () => {
        validationStarted();
        await validation;
        return new Response("{}");
      },
    });
    const root = await listen(server);
    const controller = new AbortController();
    const request = fetch(`${root}/mcp`, {
      method: "POST",
      headers: {
        authorization: "Bearer disconnect-token",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      signal: controller.signal,
    }).catch(() => undefined);
    try {
      await started;
      controller.abort();
      await request;
      finishValidation();
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      finishValidation();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
