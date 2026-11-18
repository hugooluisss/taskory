export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function reportCostMicros(provider: string, usage: TokenUsage): number {
  const inputRate = price(
    "LLM_PRICE_INPUT_PER_MTOK",
    provider === "deepseek" ? 0.3 : 0,
  );
  const outputRate = price(
    "LLM_PRICE_OUTPUT_PER_MTOK",
    provider === "deepseek" ? 1.2 : 0,
  );
  return Math.round(
    usage.promptTokens * inputRate + usage.completionTokens * outputRate,
  );
}

function price(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${name} must be a non-negative number`);
  return parsed;
}
