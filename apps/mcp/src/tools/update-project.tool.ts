import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { bearerToken } from "./token.js";
import { toolError, toolResult } from "./tool-result.js";

export function registerUpdateProject(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "update_project",
    "Update a project by id or case-insensitive name. Use when the user asks to change a project.",
    {
      id: z
        .string()
        .uuid()
        .optional()
        .describe("Project UUID; use this to rename by providing name too."),
      name: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional()
        .describe(
          "Project name to resolve when id is omitted, or replacement name when id is supplied.",
        ),
      description: z
        .string()
        .trim()
        .max(1000)
        .nullable()
        .optional()
        .describe("New description, or null to clear it."),
      archived: z
        .boolean()
        .optional()
        .describe("Whether the project is archived."),
    },
    async (args, extra) => {
      try {
        if (!args.id && !args.name)
          throw new Error("VALIDATION_ERROR: Provide id or name.");
        if (
          args.id &&
          !args.name &&
          args.description === undefined &&
          args.archived === undefined
        )
          throw new Error("VALIDATION_ERROR: Provide a field to update.");
        return toolResult(
          await service.updateProject(bearerToken(extra), args),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
