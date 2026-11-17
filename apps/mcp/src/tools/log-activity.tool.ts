import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { calendarDate, timezone } from "./validation.js";
import { bearerToken } from "./token.js";

export function registerLogActivity(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "log_activity",
    "Record work the user has just completed. Use this when the user asks to log, track, or remember an activity.",
    {
      title: z
        .string()
        .min(1)
        .max(200)
        .describe("Short title of the completed work (required)."),
      date: calendarDate
        .optional()
        .describe("Activity date in YYYY-MM-DD; defaults to today."),
      timezone: timezone
        .optional()
        .describe(
          "Optional IANA timezone; pass the user’s local date or timezone whenever known.",
        ),
      description: z
        .string()
        .max(10000)
        .optional()
        .describe("Optional details about the work."),
      referenceUrls: z
        .array(z.string())
        .max(20)
        .optional()
        .describe("Optional related URLs, up to 20."),
      tags: z
        .array(z.string().max(50))
        .max(20)
        .optional()
        .describe("Optional labels for later filtering, up to 20."),
      project: z
        .string()
        .max(100)
        .optional()
        .describe("Optional project name."),
    },
    async (args, extra) => {
      try {
        return toolResult(await service.log(bearerToken(extra), args));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
