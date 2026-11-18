import { describe, expect, it } from "vitest";
import {
  defaultFakeTaskoryHandler,
  type FakeTaskoryRequest,
} from "./support/fake-taskory-api.js";
import { contentText, withMcpClient } from "./support/mcp-system.js";

const reportId = "00000000-0000-4000-8000-000000000002";
const reportArgs = { from: "2026-01-01", to: "2026-01-31" };

describe("generate_report 200 response", () => {
  it("Returns Markdown with provider, model, and activityCount", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "report-token",
      async ({ client }) => {
        const result = JSON.parse(
          contentText(
            await client.callTool({
              name: "generate_report",
              arguments: reportArgs,
            }),
          ),
        );
        expect(result).toEqual({
          markdown: "# Report",
          provider: "local",
          model: "test-model",
          totalTokens: 10,
          promptTokens: 7,
          completionTokens: 3,
          costUsd: 0,
          activityCount: 3,
        });
      },
    );
  });

  it("MCP tool", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "report-token",
      async ({ client, system }) => {
        await client.callTool({
          name: "generate_report",
          arguments: {
            ...reportArgs,
            projects: ["Alpha", "Beta"],
            provider: "other",
            model: "caller-choice",
          },
        });
        expect(
          system.apiRequests.find((item) => item.url === "/api/v1/reports")
            ?.body,
        ).toMatchObject({ projects: ["Alpha", "Beta"] });
        expect(
          system.apiRequests.find((item) => item.url === "/api/v1/reports")
            ?.body,
        ).not.toHaveProperty("provider");
        expect(
          system.apiRequests.find((item) => item.url === "/api/v1/reports")
            ?.body,
        ).not.toHaveProperty("model");
      },
    );
  });
});

describe("Asynchronous reports", () => {
  it("Returns queued status and progress", async () => {
    await readStatus(
      { status: "queued", progress: { done: 0, total: 2 } },
      (result) => {
        expect(result).toMatchObject({
          status: "queued",
          progress: { done: 0, total: 2 },
        });
      },
    );
  });

  it("Returns running status and progress", async () => {
    await readStatus(
      { status: "running", progress: { done: 1, total: 2 } },
      (result) => {
        expect(result).toMatchObject({
          status: "running",
          progress: { done: 1, total: 2 },
        });
      },
    );
  });

  it("Returns completed Markdown", async () => {
    await readStatus(
      {
        status: "completed",
        progress: { done: 2, total: 2 },
        markdown: "# Finished",
      },
      (result) => {
        expect(result).toMatchObject({ markdown: "# Finished" });
      },
    );
  });

  it("Returns the failed error code and chunk", async () => {
    await readStatus(
      {
        status: "failed",
        progress: { done: 1, total: 2 },
        error: { code: "LLM_UNAVAILABLE", chunk: 2 },
      },
      (result) => {
        expect(result).toMatchObject({
          error: { code: "LLM_UNAVAILABLE", chunk: 2 },
        });
      },
    );
  });
});

async function readStatus(
  status: Record<string, unknown>,
  verify: (result: Record<string, unknown>) => void,
): Promise<void> {
  await withMcpClient(
    (request: FakeTaskoryRequest) => {
      if (request.url === "/api/v1/auth/me")
        return defaultFakeTaskoryHandler(request);
      return { body: { id: reportId, ...status } };
    },
    "report-token",
    async ({ client }) => {
      const result = JSON.parse(
        contentText(
          await client.callTool({
            name: "get_report",
            arguments: { id: reportId },
          }),
        ),
      ) as Record<string, unknown>;
      verify(result);
    },
  );
}
