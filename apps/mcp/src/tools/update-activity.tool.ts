import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { calendarDate } from "./validation.js";
import { bearerToken } from "./token.js";

export function registerUpdateActivity(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "update_activity",
    "Correct or change a previously logged activity. Use only when the user asks to edit an entry.",
    {
      id: z.string().uuid().describe("UUID of the activity to update."),
      date: calendarDate
        .optional()
        .describe("Replacement activity date in YYYY-MM-DD."),
      title: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe("Replacement title."),
      description: z
        .string()
        .max(10000)
        .nullable()
        .optional()
        .describe("Replacement description, or null to clear it."),
      referenceUrls: z
        .array(z.string())
        .max(20)
        .optional()
        .describe("Replacement related URLs, up to 20."),
      tags: z
        .array(z.string().max(50))
        .max(20)
        .optional()
        .describe("Replacement tags, up to 20."),
      project: z
        .string()
        .max(100)
        .nullable()
        .optional()
        .describe("Replacement project, or null to clear it."),
    },
    async (args, extra) => {
      try {
        const { id, ...fields } = args;
        if (Object.keys(fields).length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "VALIDATION_ERROR: Provide at least one field to update.",
              },
            ],
          };
        }
        return toolResult(await service.update(bearerToken(extra), id, fields));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
