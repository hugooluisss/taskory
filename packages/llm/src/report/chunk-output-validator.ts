import type { Highlight } from "./report-memory";
import {
  MAX_CHUNK_HIGHLIGHTS,
  MAX_CHUNK_SUMMARY_LENGTH,
  MAX_HIGHLIGHT_REASON_LENGTH,
} from "./report-constants";

type ProviderHighlight = Pick<Highlight, "activityId" | "impact" | "reason">;
type AllowedActivity = { date: string; title: string; project?: string | null };

export function validateChunkOutput(
  value: unknown,
  allowed: Map<string, AllowedActivity>,
): { summary: string; highlights: ProviderHighlight[] } | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const output = value as { summary?: unknown; highlights?: unknown };
  if (
    !isNonEmptyString(output.summary) ||
    output.summary.length > MAX_CHUNK_SUMMARY_LENGTH ||
    !Array.isArray(output.highlights)
  ) {
    return undefined;
  }
  if (output.highlights.length > MAX_CHUNK_HIGHLIGHTS) {
    return undefined;
  }
  const highlights: ProviderHighlight[] = [];
  for (const item of output.highlights) {
    const highlight = validateHighlight(item, allowed);
    if (!highlight) {
      return undefined;
    }
    highlights.push(highlight);
  }
  return { summary: output.summary, highlights };
}

function validateHighlight(
  value: unknown,
  allowed: Map<string, AllowedActivity>,
): ProviderHighlight | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const highlight = value as {
    activityId?: unknown;
    impact?: unknown;
    reason?: unknown;
  };
  if (
    !isNonEmptyString(highlight.activityId) ||
    !isNonEmptyString(highlight.reason) ||
    highlight.reason.length > MAX_HIGHLIGHT_REASON_LENGTH
  ) {
    return undefined;
  }
  if (highlight.impact !== "high" && highlight.impact !== "medium") {
    return undefined;
  }
  if (!allowed.has(highlight.activityId)) {
    return undefined;
  }
  return {
    activityId: highlight.activityId,
    impact: highlight.impact,
    reason: highlight.reason,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
