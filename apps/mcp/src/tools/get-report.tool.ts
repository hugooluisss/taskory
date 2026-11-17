import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { bearerToken } from "./token.js";
import { reportResult } from "./report-format.js";

export function registerGetReport(
  server: McpServer,
  service: ReportToolsService,
): void {
  server.tool(
    "get_report",
    "Check an asynchronous report job. Use with the id returned by generate_report when it says to check later.",
    {
      id: z
        .string()
        .uuid()
        .describe("UUID of the report job returned by generate_report."),
    },
    async (args, extra) => {
      try {
        const report = await service.get(bearerToken(extra), args.id);
        return toolResult(
          report.status === "completed" && report.markdown
            ? reportResult(report)
            : report,
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
