import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { toolError, toolResult } from "./tool-result.js";
import { calendarDate } from "./validation.js";
import { bearerToken } from "./token.js";
import { reportResult } from "./report-format.js";

export function registerGenerateReport(
  server: McpServer,
  service: ReportToolsService,
): void {
  server.tool(
    "generate_report",
    "Create a Markdown summary of the user’s work. Use when asked for a progress update, work recap, or report over a date range.",
    {
      from: calendarDate.describe("Inclusive report start date in YYYY-MM-DD."),
      to: calendarDate.describe("Inclusive report end date in YYYY-MM-DD."),
      projects: z
        .array(z.string().trim().min(1).max(100))
        .max(20)
        .optional()
        .describe(
          "Optional list of project filters; activities in any selected project are included.",
        ),
      tags: z
        .array(z.string().max(50))
        .max(20)
        .optional()
        .describe("Optional tags to include, up to 20."),
      language: z
        .enum(["es", "en"])
        .default("en")
        .describe("Report language, English or Spanish."),
      style: z
        .enum(["summary", "detailed", "custom"])
        .optional()
        .describe("Optional report detail level."),
      customPrompt: z
        .string()
        .optional()
        .describe("Required for custom style; instruction prompt, up to 2000 characters."),
    },
    async (args, extra) => {
      try {
        if (
          args.style === "custom" &&
          (!args.customPrompt?.trim() || args.customPrompt.trim().length > 2000)
        ) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "VALIDATION_ERROR: customPrompt must contain 1 to 2000 characters when style is custom.",
              },
            ],
          };
        }
        return toolResult(
          reportResult(await service.generate(bearerToken(extra), args)),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
