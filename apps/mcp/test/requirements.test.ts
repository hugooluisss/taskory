import { describe, expect, it, vi } from "vitest";
import {
  defaultFakeTaskoryHandler,
  type FakeTaskoryRequest,
} from "./support/fake-taskory-api.js";
import {
  contentText,
  withMcpClient,
  withMcpSystem,
} from "./support/mcp-system.js";

const validToken = "valid-token";
const activityId = "00000000-0000-4000-8000-000000000001";
const reportId = "00000000-0000-4000-8000-000000000002";

describe("MCP endpoint and authentication", () => {
  it("Serves a configurable MCP route with its matching OAuth challenge", async () => {
    await withMcpSystem(
      defaultFakeTaskoryHandler,
      async (system) => {
        const response = await fetch(`${system.root}/taskory-mcp`, {
          method: "POST",
        });
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe(
          'Bearer resource_metadata="https://taskory.test/.well-known/oauth-protected-resource/taskory-mcp"',
        );
        const options = await fetch(`${system.root}/taskory-mcp`, {
          method: "OPTIONS",
        });
        expect(options.status).toBe(204);
        expect(options.headers.get("access-control-allow-origin")).toBe("*");
      },
      { mcpPath: "/taskory-mcp" },
    );
  });

  it("Missing token starts OAuth discovery", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/mcp`, { method: "POST" });
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe(
        'Bearer resource_metadata="https://taskory.test/.well-known/oauth-protected-resource"',
      );
      expect(system.apiRequests).toHaveLength(0);
    });
  });

  it("Zero-configuration connection exposes the exact discovery URL without serving metadata", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/mcp`, { method: "POST" });
      expect(response.headers.get("www-authenticate")).toBe(
        'Bearer resource_metadata="https://taskory.test/.well-known/oauth-protected-resource"',
      );
      expect(
        new URL(
          response.headers
            .get("www-authenticate")!
            .match(/resource_metadata="([^"]+)"/)![1],
        ).pathname,
      ).toBe("/.well-known/oauth-protected-resource");
      const metadata = await fetch(
        `${system.root}/.well-known/oauth-protected-resource`,
      );
      expect(metadata.status).toBe(404);
    });
  });

  it.todo("Zero-configuration OAuth end-to-end flow with a real MCP client");

  it("Per-user identity", async () => {
    const seen: FakeTaskoryRequest[] = [];
    const handler = (request: FakeTaskoryRequest) => {
      seen.push(request);
      return defaultFakeTaskoryHandler(request);
    };
    await withMcpSystem(handler, async (system) => {
      const clientA = await system.connect("token-a");
      const clientB = await system.connect("token-b");
      try {
        await clientA.callTool({ name: "list_activities", arguments: {} });
        await clientB.callTool({ name: "list_activities", arguments: {} });
      } finally {
        await Promise.all([clientA.close(), clientB.close()]);
      }
    });
    expect(
      seen
        .filter(
          (request) =>
            request.method === "GET" && request.url === "/api/v1/activities",
        )
        .map((request) => request.authorization),
    ).toEqual(["Bearer token-a", "Bearer token-b"]);
  });

  it("Expired token", async () => {
    await withMcpSystem(
      (request) =>
        request.url.endsWith("/auth/me")
          ? {
              status: 401,
              body: {
                statusCode: 401,
                code: "UNAUTHORIZED",
                message: "Expired.",
              },
            }
          : defaultFakeTaskoryHandler(request),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer expired-token" },
        });
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe(
          'Bearer resource_metadata="https://taskory.test/.well-known/oauth-protected-resource"',
        );
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(response.headers.get("access-control-expose-headers")).toContain(
          "WWW-Authenticate",
        );
        expect(system.apiRequests).toHaveLength(1);
      },
    );
  });

  it("API 401 still gives the discovery challenge", async () => {
    await withMcpSystem(
      (request) =>
        request.url.endsWith("/auth/me")
          ? {
              status: 401,
              body: { code: "UNAUTHORIZED", message: "do not leak" },
            }
          : defaultFakeTaskoryHandler(request),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer failing-token" },
        });
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toContain(
          "oauth-protected-resource",
        );
        expect(await response.text()).toBe("");
      },
    );
  });

  it("API 403 during token validation is UPSTREAM_REJECTED", async () => {
    await withMcpSystem(
      (request) =>
        request.url.endsWith("/auth/me")
          ? {
              status: 403,
              body: { code: "PRIVATE", message: "private upstream body" },
            }
          : defaultFakeTaskoryHandler(request),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer failing-token" },
        });
        expect(response.status).toBe(502);
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        const body = await response.text();
        expect(JSON.parse(body)).toEqual({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "UPSTREAM_REJECTED: The Taskory API rejected the request",
            data: { code: "UPSTREAM_REJECTED" },
          },
          id: null,
        });
        expect(body).not.toContain("private upstream body");
      },
    );
  });
});

describe("Token forwarding without shared credentials", () => {
  it("Invalid token", async () => {
    await withMcpSystem(
      (request) =>
        request.url.endsWith("/auth/me")
          ? {
              status: 401,
              body: {
                statusCode: 401,
                code: "UNAUTHORIZED",
                message: "Invalid token.",
              },
            }
          : defaultFakeTaskoryHandler(request),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer bad-token" },
        });
        expect(response.status).toBe(401);
        expect(
          system.apiRequests.some(
            (request) => request.url === "/api/v1/activities",
          ),
        ).toBe(false);
      },
    );
  });

  it("Returns a reconnect tool error when the API revokes a token during a tool call", async () => {
    const result = await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/activities")
          return {
            status: 401,
            body: { code: "UNAUTHORIZED", message: "revoked" },
          };
        return defaultFakeTaskoryHandler(request);
      },
      "race-token",
      async ({ client }) =>
        client.callTool({ name: "list_activities", arguments: {} }),
    );
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain(
      "UNAUTHORIZED: The session was revoked; reconnect or reauthorize",
    );
  });
});

describe("Cross-origin preflight", () => {
  it("Browser preflight", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/mcp`, {
        method: "OPTIONS",
        headers: {
          origin: "https://client.test",
          "access-control-request-method": "POST",
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "POST, GET, DELETE, OPTIONS",
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "authorization",
      );
      expect(response.headers.get("access-control-max-age")).toBe("600");
      expect(system.apiRequests).toHaveLength(0);
    });
  });
});

describe("Upstream failures are distinguishable", () => {
  it("API unreachable during validation returns retryable JSON-RPC error", async () => {
    await withMcpSystem(
      () => ({ closeSocket: true }),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${validToken}` },
        });
        expect(response.status).toBe(503);
        expect(response.headers.get("retry-after")).toBe("5");
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(await response.json()).toEqual({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "UPSTREAM_UNAVAILABLE: the Taskory API is temporarily unavailable; this can be retried",
            data: { code: "UPSTREAM_UNAVAILABLE" },
          },
          id: null,
        });
      },
    );
  });

  it("API timeout during validation returns UPSTREAM_UNAVAILABLE", async () => {
    await withMcpSystem(
      () => ({ delayMs: 100 }),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${validToken}` },
        });
        expect(response.status).toBe(503);
        expect((await response.json()).error.data.code).toBe(
          "UPSTREAM_UNAVAILABLE",
        );
      },
      { timeoutMs: 10 },
    );
  });

  it("API 500 during validation returns UPSTREAM_UNAVAILABLE", async () => {
    await withMcpSystem(
      () => ({
        status: 500,
        body: { code: "PRIVATE", message: "private upstream body" },
      }),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${validToken}` },
        });
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain(
          "private upstream body",
        );
      },
    );
  });

  it("API 429 during validation returns RATE_LIMITED and forwards Retry-After", async () => {
    await withMcpSystem(
      () => ({
        status: 429,
        headers: { "Retry-After": "17" },
        body: { code: "PRIVATE", message: "private upstream body" },
      }),
      async (system) => {
        const response = await fetch(`${system.root}/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${validToken}` },
        });
        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("17");
        expect((await response.json()).error.data.code).toBe("RATE_LIMITED");
      },
    );
  });

  it("Never returns the token in the response body or logs", async () => {
    const token = "secret-token-value";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const responseBody = await withMcpSystem(
        () => ({ closeSocket: true }),
        async (system) => {
          const response = await fetch(`${system.root}/mcp`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
          });
          return await response.text();
        },
      );
      expect(responseBody).not.toContain(token);
      expect(log.mock.calls.flat().join(" ")).not.toContain(token);
    } finally {
      log.mockRestore();
    }
  });
});

describe("log_activity", () => {
  it("Log with defaults", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        const result = await client.callTool({
          name: "log_activity",
          arguments: { title: "Work", timezone: "Asia/Tokyo" },
        });
        expect(JSON.parse(contentText(result))).toMatchObject({
          id: "new-activity",
          title: "Work",
        });
        const body = system.apiRequests.find(
          (request) =>
            request.url === "/api/v1/activities" && request.method === "POST",
        )?.body as { date: string };
        expect(body.date).toBe("2026-11-18");
      },
      { now: () => new Date("2026-11-17T23:30:00.000Z") },
    );
  });

  it("Finds a case-insensitive project or creates it before logging", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return { body: [{ id: "p1", name: "SIGEI", archived: true }] };
        if (request.url === "/api/v1/activities" && request.method === "POST")
          return {
            status: 201,
            body: { id: "a1", projects: [{ id: "p1", name: "SIGEI" }] },
          };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "log_activity",
          arguments: { title: "Work", projects: ["sigei"] },
        });
        expect(
          system.apiRequests.filter(
            (request) =>
              request.url === "/api/v1/projects" && request.method === "POST",
          ),
        ).toHaveLength(0);
        expect(
          system.apiRequests.find(
            (request) =>
              request.url === "/api/v1/activities" && request.method === "POST",
          )?.body,
        ).toMatchObject({ projectIds: ["p1"] });
      },
    );
  });

  it("Creates a missing project before logging", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return { body: [] };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "log_activity",
          arguments: { title: "Work", project: "New" },
        });
        expect(
          system.apiRequests.find(
            (request) =>
              request.url === "/api/v1/projects" && request.method === "POST",
          )?.body,
        ).toEqual({ name: "New" });
        expect(
          system.apiRequests.find(
            (request) =>
              request.url === "/api/v1/activities" && request.method === "POST",
          )?.body,
        ).toMatchObject({ projectIds: ["new-project"] });
      },
    );
  });

  it("Deduplicates project names case-insensitively before lookup and creation", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return { body: [{ id: "p1", name: "SIGEI", archived: false }] };
        if (request.url === "/api/v1/projects" && request.method === "POST")
          return {
            status: 201,
            body: {
              id: "p2",
              name: (request.body as { name: string }).name,
              archived: false,
            },
          };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "log_activity",
          arguments: {
            title: "Work",
            projects: ["SIGEI", "sigei", "New", "new"],
          },
        });
        const creations = system.apiRequests.filter(
          (request) =>
            request.url === "/api/v1/projects" && request.method === "POST",
        );
        expect(creations).toHaveLength(1);
        expect(creations[0]?.body).toEqual({ name: "New" });
        expect(
          system.apiRequests.find(
            (request) =>
              request.url === "/api/v1/activities" && request.method === "POST",
          )?.body,
        ).toMatchObject({ projectIds: ["p1", "p2"] });
      },
    );
  });

  it("Lists only non-archived projects", async () => {
    const result = await withMcpClient(
      (request) =>
        request.url === "/api/v1/projects"
          ? {
              body: [
                {
                  id: "a",
                  name: "Active",
                  description: "Context",
                  archived: false,
                },
                { id: "b", name: "Old", archived: true },
              ],
            }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client }) =>
        JSON.parse(
          contentText(
            await client.callTool({ name: "list_projects", arguments: {} }),
          ),
        ),
    );
    expect(result).toEqual([
      { id: "a", name: "Active", description: "Context", archived: false },
    ]);
  });

  it("Creates projects with descriptions", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "create_project",
          arguments: { name: "New", description: " Context " },
        });
        expect(
          system.apiRequests.find(
            (request) =>
              request.url === "/api/v1/projects" && request.method === "POST",
          )?.body,
        ).toEqual({ name: "New", description: "Context" });
      },
    );
  });

  it("Updates a project by case-insensitive name", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return {
            body: [
              { id: "p1", name: "Alpha", archived: false, description: null },
            ],
          };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "update_project",
          arguments: {
            name: "alpha",
            description: " Context ",
            archived: true,
          },
        });
        expect(
          system.apiRequests.find((request) => request.method === "PATCH")?.url,
        ).toBe("/api/v1/projects/p1");
        expect(
          system.apiRequests.find((request) => request.method === "PATCH")
            ?.body,
        ).toEqual({ description: "Context", archived: true });
      },
    );
  });

  it("Rejects an invalid IANA timezone before the API call", async () => {
    const result = await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        const tool = await client.callTool({
          name: "log_activity",
          arguments: { title: "Work", timezone: "Mars/Olympus" },
        });
        return {
          tool,
          requests: system.apiRequests.filter(
            (request) => request.method === "POST",
          ),
        };
      },
    );
    expect(result.tool.isError).toBe(true);
    expect(result.requests).toHaveLength(0);
  });
});

describe("list_activities", () => {
  it("Filter by range", async () => {
    let queriedUrl = "";
    await withMcpClient(
      (request) => {
        if (request.url.startsWith("/api/v1/activities?")) {
          queriedUrl = request.url;
          const query = new URLSearchParams(request.url.split("?")[1]);
          return {
            body: {
              items: [
                { id: activityId, date: query.get("from"), title: "In range" },
              ],
              total: 1,
            },
          };
        }
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client }) => {
        const result = JSON.parse(
          contentText(
            await client.callTool({
              name: "list_activities",
              arguments: { from: "2026-02-01", to: "2026-02-28" },
            }),
          ),
        );
        expect(result.items).toEqual([
          expect.objectContaining({ date: "2026-02-01" }),
        ]);
        expect(queriedUrl).toContain("from=2026-02-01");
        expect(queriedUrl).toContain("to=2026-02-28");
      },
    );
  });

  it("Resolves project names to projectIds", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "list_activities",
          arguments: { project: "alpha" },
        });
        expect(
          system.apiRequests.find((request) =>
            request.url.startsWith("/api/v1/activities?"),
          )?.url,
        ).toContain("projectIds=project-1");
      },
    );
  });

  it("More results than one page", async () => {
    await withMcpClient(
      (request) =>
        request.url.startsWith("/api/v1/activities") && request.method === "GET"
          ? {
              body: {
                items: [
                  {
                    id: `page-${new URL(request.url, "http://api.test").searchParams.get("page") ?? 1}`,
                  },
                ],
                total: 120,
                page: Number(
                  new URL(request.url, "http://api.test").searchParams.get(
                    "page",
                  ) ?? 1,
                ),
                limit: 50,
              },
            }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client }) => {
        const result = JSON.parse(
          contentText(
            await client.callTool({ name: "list_activities", arguments: {} }),
          ),
        );
        expect(result.summary).toBe(
          "page 1 of 3, total 120; More results exist; request page 2 with list_activities.",
        );
        const nextPage = JSON.parse(
          contentText(
            await client.callTool({
              name: "list_activities",
              arguments: { page: 2 },
            }),
          ),
        );
        expect(nextPage.page).toBe(2);
        expect(nextPage.items[0].id).toBe("page-2");
      },
    );
  });
});

describe("update_activity and delete_activity", () => {
  it("Resolves update project names to projectIds", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, projects: ["alpha"] },
        });
        expect(
          system.apiRequests.find((request) => request.method === "PATCH")
            ?.body,
        ).toMatchObject({ projectIds: ["project-1"] });
      },
    );
  });

  it("Finds an existing project case-insensitively through the update alias", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return { body: [{ id: "p1", name: "SIGEI", archived: true }] };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, project: "sigei" },
        });
        expect(
          system.apiRequests.find((request) => request.method === "PATCH")
            ?.body,
        ).toMatchObject({ projectIds: ["p1"] });
        expect(
          system.apiRequests.some(
            (request) =>
              request.url === "/api/v1/projects" && request.method === "POST",
          ),
        ).toBe(false);
      },
    );
  });

  it("Creates missing projects during update and clears links with an empty array", async () => {
    await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/projects" && request.method === "GET")
          return { body: [] };
        return defaultFakeTaskoryHandler(request);
      },
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, projects: ["New"] },
        });
        await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, projects: [] },
        });
        const patches = system.apiRequests.filter(
          (request) => request.method === "PATCH",
        );
        expect(patches[0]?.body).toMatchObject({ projectIds: ["new-project"] });
        expect(patches[1]?.body).toMatchObject({ projectIds: [] });
      },
    );
  });

  it("Omits projectIds when project fields are not supplied", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, title: "Changed" },
        });
        expect(
          system.apiRequests.find((request) => request.method === "PATCH")
            ?.body,
        ).not.toHaveProperty("projectIds");
      },
    );
  });

  it("Unknown id", async () => {
    await withMcpClient(
      (request) =>
        request.url.includes(activityId)
          ? {
              status: 404,
              body: {
                statusCode: 404,
                code: "NOT_FOUND",
                message: "Activity was not found.",
              },
            }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client }) => {
        const updated = await client.callTool({
          name: "update_activity",
          arguments: { id: activityId, title: "x" },
        });
        const deleted = await client.callTool({
          name: "delete_activity",
          arguments: { id: activityId },
        });
        expect(updated.isError).toBe(true);
        expect(contentText(updated)).toContain("Activity was not found.");
        expect(deleted.isError).toBe(true);
        expect(contentText(deleted)).toContain("NOT_FOUND");
      },
    );
  });
});

describe("generate_report", () => {
  it("Resolves project names to projectIds", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client, system }) => {
        await client.callTool({
          name: "generate_report",
          arguments: {
            from: "2026-02-01",
            to: "2026-02-28",
            projects: ["alpha"],
          },
        });
        expect(
          system.apiRequests.find(
            (request) => request.url === "/api/v1/reports",
          )?.body,
        ).toMatchObject({ projectIds: ["project-1"] });
      },
    );
  });

  it("Returns a clear error when a project name is unknown", async () => {
    const result = await withMcpClient(
      (request) =>
        request.url === "/api/v1/projects"
          ? { body: [] }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client, system }) => ({
        result: await client.callTool({
          name: "generate_report",
          arguments: {
            from: "2026-02-01",
            to: "2026-02-28",
            projects: ["Missing"],
          },
        }),
        requests: system.apiRequests,
      }),
    );
    expect(result.result.isError).toBe(true);
    expect(contentText(result.result)).toContain(
      "PROJECT_NOT_FOUND: Project not found: Missing",
    );
    expect(
      result.requests.some((request) => request.url === "/api/v1/reports"),
    ).toBe(false);
  });

  it("Report returned", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client }) => {
        const result = await client.callTool({
          name: "generate_report",
          arguments: { from: "2026-02-01", to: "2026-02-28" },
        });
        expect(JSON.parse(contentText(result))).toEqual({
          id: reportId,
          markdown: "# Report",
          provider: "local",
          model: "test-model",
          totalTokens: 10,
          promptTokens: 7,
          completionTokens: 3,
          costUsd: 0,
          activityCount: 3,
          shareUrl: "https://taskory.test/shared/token",
          shareExpiresAt: "2026-03-30T00:00:00.000Z",
        });
      },
    );
  });
});

describe("Tool descriptions guide the agent", () => {
  it("Tool discovery", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      validToken,
      async ({ client }) => {
        const listed = await client.listTools();
        expect(listed.tools).toHaveLength(11);
        for (const tool of listed.tools) {
          expect(tool.description).toMatch(/use/i);
          const properties = tool.inputSchema.properties as Record<
            string,
            { description?: string }
          >;
          if (!["list_projects", "list_report_styles"].includes(tool.name))
            expect(Object.keys(properties).length).toBeGreaterThan(0);
          for (const parameter of Object.values(properties))
            expect(parameter.description?.trim()).toBeTruthy();
        }
      },
    );
  });
});

describe("Asynchronous reports", () => {
  it("Large report", async () => {
    await withMcpClient(
      (request) =>
        request.url === "/api/v1/reports" && request.method === "POST"
          ? {
              status: 202,
              body: {
                id: reportId,
                status: "queued",
                progress: { done: 0, total: 3 },
                shareUrl: "https://taskory.test/shared/token",
                shareExpiresAt: "2026-03-30T00:00:00.000Z",
              },
            }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client }) => {
        const result = JSON.parse(
          contentText(
            await client.callTool({
              name: "generate_report",
              arguments: { from: "2026-02-01", to: "2026-02-28" },
            }),
          ),
        );
        expect(result).toMatchObject({
          id: reportId,
          status: "queued",
          progress: { done: 0, total: 3 },
          shareUrl: "https://taskory.test/shared/token",
          shareExpiresAt: "2026-03-30T00:00:00.000Z",
        });
        expect(result.instruction).toContain(`get_report with id ${reportId}`);
      },
    );
  });

  it("Completed report", async () => {
    await withMcpClient(
      (request) =>
        request.url.endsWith(reportId)
          ? {
              body: {
                id: reportId,
                status: "completed",
                progress: { done: 2, total: 2 },
                markdown: "# Done",
              },
            }
          : defaultFakeTaskoryHandler(request),
      validToken,
      async ({ client }) => {
        const result = await client.callTool({
          name: "get_report",
          arguments: { id: reportId },
        });
        expect(contentText(result)).toContain("# Done");
      },
    );
  });
});
