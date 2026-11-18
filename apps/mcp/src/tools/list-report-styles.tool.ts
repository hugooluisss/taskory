import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { bearerToken } from "./token.js";
import { toolError, toolResult } from "./tool-result.js";

export function registerListReportStyles(
  server: McpServer,
  service: ReportToolsService,
): void {
  server.tool(
    "list_report_styles",
    "List report styles and their prompts, including the saved custom prompt. Use before generating a report to inspect available styles.",
    {},
    async (_args, extra) => {
      try {
        return toolResult(await service.listStyles(bearerToken(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
