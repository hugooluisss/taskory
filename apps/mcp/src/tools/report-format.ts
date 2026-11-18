import type { ReportJob, ReportResult } from "../types/api.js";

export function reportResult(report: ReportResult | ReportJob): unknown {
  if ("markdown" in report && report.markdown !== undefined) {
    if ("provider" in report) {
      return {
        markdown: report.markdown,
        provider: report.provider,
        model: report.model,
        totalTokens: report.totalTokens,
        promptTokens: report.promptTokens,
        completionTokens: report.completionTokens,
        costUsd: report.costUsd,
        activityCount: report.activityCount,
      };
    }
    return {
      id: report.id,
      status: report.status,
      progress: report.progress,
      markdown: report.markdown,
      provider: report.provider,
      model: report.model,
      promptTokens: report.promptTokens,
      completionTokens: report.completionTokens,
      totalTokens: report.totalTokens,
      costUsd: report.costUsd,
    };
  }
  if ("id" in report) {
    return {
      id: report.id,
      status: report.status,
      progress: report.progress,
      instruction: `Call get_report with id ${report.id} later.`,
    };
  }
  return report;
}
