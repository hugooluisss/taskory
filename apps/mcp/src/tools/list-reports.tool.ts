import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { bearerToken } from "./token.js";

export function registerListReports(
  server: McpServer,
  service: ReportToolsService,
): void {
  server.tool(
    "list_reports",
    "List the user's reports without Markdown, newest first.",
    {
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Page number (default 1)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Items per page (default 50, max 200)."),
    },
    async (args, extra) => {
      try {
        return toolResult(
          await service.list(bearerToken(extra), args.page, args.limit),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
