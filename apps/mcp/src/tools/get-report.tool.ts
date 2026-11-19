import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { bearerToken } from "./token.js";

export function registerGetReport(
  server: McpServer,
  service: ReportToolsService,
): void {
  server.tool(
    "get_report",
    "Use a report id to read its status and Markdown.",
    {
      id: z
        .string()
        .uuid()
        .describe("UUID of the report job returned by generate_report."),
    },
    async (args, extra) => {
      try {
        const report = await service.get(bearerToken(extra), args.id);
        return toolResult(report);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
