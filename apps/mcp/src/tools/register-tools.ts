import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ActivityToolsService } from "../services/activity-tools.service.js";
import type { ReportToolsService } from "../services/report-tools.service.js";
import { registerDeleteActivity } from "./delete-activity.tool.js";
import { registerGenerateReport } from "./generate-report.tool.js";
import { registerGetReport } from "./get-report.tool.js";
import { registerListActivities } from "./list-activities.tool.js";
import { registerListProjects } from "./list-projects.tool.js";
import { registerLogActivity } from "./log-activity.tool.js";
import { registerUpdateActivity } from "./update-activity.tool.js";

export function registerTools(
  server: McpServer,
  activities: ActivityToolsService,
  reports: ReportToolsService,
): void {
  registerLogActivity(server, activities);
  registerListActivities(server, activities);
  registerListProjects(server, activities);
  registerUpdateActivity(server, activities);
  registerDeleteActivity(server, activities);
  registerGenerateReport(server, reports);
  registerGetReport(server, reports);
}
