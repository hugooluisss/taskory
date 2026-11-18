import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { bearerToken } from "./token.js";
import { toolError, toolResult } from "./tool-result.js";

export function registerCreateProject(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "create_project",
    "Create a project. Use when the user asks to add a project.",
    {
      name: z.string().trim().min(1).max(100).describe("Project name."),
      description: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .describe("Optional project description, up to 1000 characters."),
    },
    async (args, extra) => {
      try {
        return toolResult(
          await service.createProject(bearerToken(extra), args),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
