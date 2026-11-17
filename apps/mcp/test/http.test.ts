import { describe, expect, it } from "vitest";
import { withMcpSystem } from "./support/mcp-system.js";
import { defaultFakeTaskoryHandler } from "./support/fake-taskory-api.js";

describe("HTTP health and routing", () => {
  it("Returns 200 from GET /health", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });

  it("Returns 404 for an unknown path", async () => {
    await withMcpSystem(defaultFakeTaskoryHandler, async (system) => {
      const response = await fetch(`${system.root}/not-mcp`);
      expect(response.status).toBe(404);
    });
  });
});
