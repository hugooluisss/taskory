import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { calendarDate } from "./validation.js";
import { bearerToken } from "./token.js";

export function registerListActivities(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "list_activities",
    "Search the user’s activity log. Use this to answer questions about past work or inspect entries before changing or reporting on them.",
    {
      from: calendarDate
        .optional()
        .describe("Inclusive start date in YYYY-MM-DD."),
      to: calendarDate.optional().describe("Inclusive end date in YYYY-MM-DD."),
      project: z.string().optional().describe("Filter by project name."),
      tag: z.string().optional().describe("Filter by tag."),
      q: z.string().optional().describe("Search activity text."),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Page number, starting at 1."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Page size; defaults to 50 and cannot exceed 200."),
    },
    async (args, extra) => {
      try {
        const result = await service.list(bearerToken(extra), args);
        const page = result.page ?? args.page ?? 1;
        const limit = result.limit ?? args.limit ?? 50;
        const pages = Math.ceil(result.total / limit);
        const more =
          page < pages
            ? ` More results exist; request page ${page + 1} with list_activities.`
            : "";
        return toolResult({
          ...result,
          page,
          limit,
          summary: `page ${page} of ${pages}, total ${result.total}${more ? `;${more}` : ""}`,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
