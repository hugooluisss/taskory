import { describe, expect, it } from "vitest";
import {
  defaultFakeTaskoryHandler,
  type FakeTaskoryRequest,
} from "./support/fake-taskory-api.js";
import { contentText, withMcpClient } from "./support/mcp-system.js";

const reportId = "00000000-0000-4000-8000-000000000002";
const reportArgs = { from: "2026-01-01", to: "2026-01-31" };

describe("generate_report 200 response", () => {
  it("Agent generates a custom report and forwards its prompt", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "report-token",
      async ({ client, system }) => {
        await client.callTool({
          name: "generate_report",
          arguments: {
            ...reportArgs,
            style: "custom",
            customPrompt: "Focus on outcomes",
          },
        });
        expect(
          system.apiRequests.find((item) => item.url === "/api/v1/reports")
            ?.body,
        ).toMatchObject({ style: "custom", customPrompt: "Focus on outcomes" });
      },
    );
  });

  it("Custom without a prompt returns a validation error without calling the API", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "report-token",
      async ({ client, system }) => {
        const result = await client.callTool({
          name: "generate_report",
          arguments: { ...reportArgs, style: "custom" },
        });
        expect(result.isError).toBe(true);
        expect(contentText(result)).toContain(
          "customPrompt must contain 1 to 2000 characters",
        );
        expect(
          system.apiRequests.some((item) => item.url === "/api/v1/reports"),
        ).toBe(false);
      },
    );
  });

  it("Lists predefined prompts and the saved custom prompt", async () => {
    await withMcpClient(
      defaultFakeTaskoryHandler,
      "report-token",
      async ({ client }) => {
        const result = JSON.parse(
          contentText(
            await client.callTool({
              name: "list_report_styles",
              arguments: {},
            }),
          ),
        );
        expect(result).toEqual({
          styles: [
            { id: "summary", prompt: { es: "Resumen", en: "Summary" } },
            { id: "detailed", prompt: { es: "Detallado", en: "Detailed" } },
          ],
          customPrompt: "Saved custom prompt",
        });
      },
    );
  });

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
            projects: ["Alpha"],
            provider: "other",
            model: "caller-choice",
          },
        });
        expect(
          system.apiRequests.find((item) => item.url === "/api/v1/reports")
            ?.body,
        ).toMatchObject({ projectIds: ["project-1"] });
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
