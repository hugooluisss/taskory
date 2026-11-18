export const MAX_CHUNK_HIGHLIGHTS = 15;
export const MAX_MEMORY_HIGHLIGHTS = 100;
export const INVALID_OUTPUT_RETRIES = 2;
export const MAX_CHUNK_SUMMARY_LENGTH = 600;
export const MAX_HIGHLIGHT_REASON_LENGTH = 240;
export const MAX_CONSOLIDATION_CHARS = 12_000;
export const DEEPSEEK_MAX_CONSOLIDATION_CHARS = 3_500_000;
export const MAX_CONSOLIDATION_LEVELS = 4;

export function maxConsolidationChars(providerId: string): number {
  const configured = Number(process.env.LLM_MAX_CONSOLIDATION_CHARS);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return providerId === "deepseek"
    ? DEEPSEEK_MAX_CONSOLIDATION_CHARS
    : MAX_CONSOLIDATION_CHARS;
}
