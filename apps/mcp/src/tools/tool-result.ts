import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "../repositories/api-error.js";
import { UpstreamUnavailable } from "../repositories/taskory-api.client.js";

export function toolResult(value: unknown): CallToolResult {
  const message = typeof value === "string" ? value : JSON.stringify(value);
  return { content: [{ type: "text", text: message }] };
}

export function toolError(error: unknown): CallToolResult {
  if (error instanceof UpstreamUnavailable) {
    return {
      isError: true,
      content: [
        { type: "text", text: `UPSTREAM_UNAVAILABLE: ${error.message}` },
      ],
    };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "UNAUTHORIZED: The session was revoked; reconnect or reauthorize with Taskory.",
          },
        ],
      };
    }
    const message =
      error.code === "REPORT_IN_PROGRESS"
        ? `${error.code}: active report ${error.message}`
        : `${error.code}: ${error.message}`;
    return { isError: true, content: [{ type: "text", text: message }] };
  }
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "INTERNAL_ERROR: The request could not be completed.",
      },
    ],
  };
}
