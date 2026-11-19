import type { ReportJob, ReportResult } from "../types/api.js";

export function reportResult(report: ReportResult | ReportJob): unknown {
  if ("markdown" in report && report.markdown !== undefined) {
    if ("provider" in report) {
      return {
        id: report.id,
        markdown: report.markdown,
        provider: report.provider,
        model: report.model,
        totalTokens: report.totalTokens,
        promptTokens: report.promptTokens,
        completionTokens: report.completionTokens,
        costUsd: report.costUsd,
        activityCount: report.activityCount,
        shareUrl: report.shareUrl,
        shareExpiresAt: report.shareExpiresAt,
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
  if ("status" in report) {
    return {
      id: report.id,
      status: report.status,
      progress: report.progress,
      ...(report.shareUrl ? { shareUrl: report.shareUrl } : {}),
      ...(report.shareExpiresAt ? { shareExpiresAt: report.shareExpiresAt } : {}),
      instruction: `Call get_report with id ${report.id} later.`,
    };
  }
  return report;
}
