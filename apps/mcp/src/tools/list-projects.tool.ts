import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { bearerToken } from "./token.js";
import { toolError, toolResult } from "./tool-result.js";

export function registerListProjects(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "list_projects",
    "List the user’s active projects. Use when choosing a project for an activity or report.",
    {},
    async (_args, extra) => {
      try {
        return toolResult(await service.projects(bearerToken(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
