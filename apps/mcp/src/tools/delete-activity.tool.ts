import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { bearerToken } from "./token.js";

export function registerDeleteActivity(
  server: McpServer,
  service: ActivityToolsService,
): void {
  server.tool(
    "delete_activity",
    "Delete a previously logged activity. Use only when the user explicitly asks to remove the entry.",
    {
      id: z.string().uuid().describe("UUID of the activity to delete."),
    },
    async (args, extra) => {
      try {
        return toolResult(await service.delete(bearerToken(extra), args.id));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
