import { describe, expect, it } from "vitest";
import { ApiError } from "../repositories/api-error.js";
import { reportResult } from "./report-format.js";
import { toolError, toolResult } from "./tool-result.js";

describe("Token forwarding without shared credentials", () => {
  it("Invalid token", () => {
    expect(
      toolError(new ApiError(404, "NOT_FOUND", "Activity was not found.")),
    ).toMatchObject({
      isError: true,
      content: [{ text: "NOT_FOUND: Activity was not found." }],
    });
  });

  it("Returns the active report identifier for REPORT_IN_PROGRESS", () => {
    expect(
      toolError(new ApiError(409, "REPORT_IN_PROGRESS", "job-1")),
    ).toMatchObject({
      content: [{ text: "REPORT_IN_PROGRESS: active report job-1" }],
    });
  });

  it("Never leaks upstream bodies or stack traces", () => {
    expect(toolError(new Error("secret stack"))).toMatchObject({
      content: [
        { text: "INTERNAL_ERROR: The request could not be completed." },
      ],
    });
  });

  it("Returns the supplied tool result as text", () => {
    expect(toolResult("ok")).toMatchObject({ content: [{ text: "ok" }] });
  });

  it("Expired token returns a reconnect instruction during a tool call", () => {
    expect(
      toolError(new ApiError(401, "UNAUTHORIZED", "private response")),
    ).toMatchObject({
      content: [{ text: expect.stringContaining("reconnect or reauthorize") }],
    });
  });
});

describe("Asynchronous reports", () => {
  it("Large report tells the agent to check later", () => {
    expect(
      reportResult({
        id: "job-2",
        status: "queued",
        progress: { done: 0, total: 2 },
      }),
    ).toMatchObject({ instruction: expect.stringContaining("job-2") });
  });
});

describe("generate_report", () => {
  it("Report returned with metadata", () => {
    expect(
      reportResult({
        markdown: "# Report",
        provider: "local",
        model: "m",
        totalTokens: 8,
        promptTokens: 5,
        completionTokens: 3,
        costUsd: 0.000001,
        activityCount: 1,
      }),
    ).toMatchObject({
      markdown: "# Report",
      provider: "local",
      model: "m",
      totalTokens: 8,
      promptTokens: 5,
      completionTokens: 3,
      costUsd: 0.000001,
      activityCount: 1,
    });
  });

  it("Completed report returns Markdown", () => {
    expect(
      reportResult({
        id: "job-1",
        status: "completed",
        progress: { done: 1, total: 1 },
        markdown: "# Done",
      }),
    ).toMatchObject({ markdown: "# Done" });
  });
});
