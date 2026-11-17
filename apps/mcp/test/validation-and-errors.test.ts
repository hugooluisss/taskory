import { describe, expect, it } from "vitest";
import {
  defaultFakeTaskoryHandler,
  type FakeTaskoryRequest,
} from "./support/fake-taskory-api.js";
import { contentText, withMcpClient } from "./support/mcp-system.js";

const id = "00000000-0000-4000-8000-000000000001";
const range = { from: "2026-01-01", to: "2026-01-31" };

async function callInvalidTool(
  name: string,
  arguments_: Record<string, unknown>,
): Promise<{ result: { isError?: boolean }; toolRequests: number }> {
  return withMcpClient(
    defaultFakeTaskoryHandler,
    "validation-token",
    async ({ client, system }) => {
      let result: { isError?: boolean };
      try {
        result = await client.callTool({ name, arguments: arguments_ });
      } catch {
        result = { isError: true };
      }
      return {
        result,
        toolRequests: system.apiRequests.filter(
          (request) => request.url !== "/api/v1/auth/me",
        ).length,
      };
    },
  );
}

describe("Tool input validation", () => {
  it("Rejects more than 20 referenceUrls before the API call", async () => {
    const outcome = await callInvalidTool("log_activity", {
      title: "x",
      referenceUrls: Array.from(
        { length: 21 },
        (_, index) => `https://example.test/${index}`,
      ),
    });
    expect(outcome.result.isError).toBe(true);
    expect(outcome.toolRequests).toBe(0);
  });

  it("Rejects more than 20 tags before the API call", async () => {
    const outcome = await callInvalidTool("log_activity", {
      title: "x",
      tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
    });
    expect(outcome.result.isError).toBe(true);
    expect(outcome.toolRequests).toBe(0);
  });

  it("Rejects a limit over 200 before the API call", async () => {
    const outcome = await callInvalidTool("list_activities", { limit: 201 });
    expect(outcome.result.isError).toBe(true);
    expect(outcome.toolRequests).toBe(0);
  });

  it("Forwards YYYY-MM-DD dates for API calendar validation", async () => {
    const response = await withMcpClient(
      (request) => {
        if (request.url === "/api/v1/auth/me")
          return defaultFakeTaskoryHandler(request);
        return {
          status: 400,
          body: {
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "Date must be a real calendar date.",
          },
        };
      },
      "validation-token",
      async ({ client, system }) => {
        const result = await client.callTool({
          name: "log_activity",
          arguments: { title: "x", date: "2026-02-30" },
        });
        const request = system.apiRequests.find(
          (entry) => entry.method === "POST",
        );
        return { result, body: request?.body };
      },
    );
    expect(response.body).toMatchObject({ date: "2026-02-30" });
    expect(contentText(response.result)).toContain(
      "VALIDATION_ERROR: Date must be a real calendar date.",
    );
  });

  it("Rejects update_activity with no fields before the API call", async () => {
    const outcome = await callInvalidTool("update_activity", { id });
    expect(outcome.result.isError).toBe(true);
    expect(outcome.toolRequests).toBe(0);
  });

  it("Rejects non-UUID ids before the API call", async () => {
    const update = await callInvalidTool("update_activity", {
      id: "not-a-uuid",
      title: "x",
    });
    const deletion = await callInvalidTool("delete_activity", {
      id: "not-a-uuid",
    });
    const report = await callInvalidTool("get_report", { id: "not-a-uuid" });
    expect(
      update.result.isError && deletion.result.isError && report.result.isError,
    ).toBe(true);
    expect(
      update.toolRequests + deletion.toolRequests + report.toolRequests,
    ).toBe(0);
  });
});

describe("Tool API error mapping", () => {
  it("Maps NOT_FOUND to a readable tool error", async () => {
    const result = await toolError(
      "NOT_FOUND",
      "Activity was not found.",
      "update_activity",
      { id, title: "x" },
    );
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain("NOT_FOUND");
    expect(contentText(result)).toContain("Activity was not found.");
  });

  it("Maps NO_ACTIVITIES to a readable tool error", async () => {
    const result = await toolError(
      "NO_ACTIVITIES",
      "No activities match this range.",
      "generate_report",
      range,
    );
    expect(contentText(result)).toContain("NO_ACTIVITIES");
    expect(contentText(result)).toContain("No activities match this range.");
  });

  it("Maps REPORT_IN_PROGRESS and includes the active report id", async () => {
    const result = await toolError(
      "REPORT_IN_PROGRESS",
      "active-job-123",
      "generate_report",
      range,
    );
    expect(contentText(result)).toContain("REPORT_IN_PROGRESS");
    expect(contentText(result)).toContain("active-job-123");
  });

  it("Maps LLM_UNAVAILABLE to a readable tool error", async () => {
    const result = await toolError(
      "LLM_UNAVAILABLE",
      "The report provider is unavailable.",
      "generate_report",
      range,
    );
    expect(contentText(result)).toContain("LLM_UNAVAILABLE");
    expect(contentText(result)).toContain(
      "The report provider is unavailable.",
    );
  });

  it("Maps RANGE_TOO_LARGE to a readable tool error", async () => {
    const result = await toolError(
      "RANGE_TOO_LARGE",
      "The requested range is too large.",
      "generate_report",
      range,
    );
    expect(contentText(result)).toContain("RANGE_TOO_LARGE");
    expect(contentText(result)).toContain("The requested range is too large.");
  });

  it("Maps VALIDATION_ERROR to a readable tool error", async () => {
    const result = await toolError(
      "VALIDATION_ERROR",
      "The date range is invalid.",
      "generate_report",
      range,
    );
    expect(contentText(result)).toContain("VALIDATION_ERROR");
    expect(contentText(result)).toContain("The date range is invalid.");
  });
});

async function toolError(
  code: string,
  message: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}> {
  return withMcpClient(
    (request: FakeTaskoryRequest) => {
      if (request.url === "/api/v1/auth/me")
        return defaultFakeTaskoryHandler(request);
      return { status: 422, body: { statusCode: 422, code, message } };
    },
    "error-token",
    async ({ client }) => client.callTool({ name, arguments: args }),
  );
}
