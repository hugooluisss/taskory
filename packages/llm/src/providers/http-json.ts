import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import type { Fetch } from "../types/llm-provider";

export const GENERATION_TIMEOUT_MS = 180_000;

export interface HttpJsonOptions<T> {
  fetcher: Fetch;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  provider: string;
  parse?: (data: unknown) => T;
  signal?: AbortSignal;
}

export async function fetchJson<T>(options: HttpJsonOptions<T>): Promise<T> {
  try {
    const response = await options.fetcher(options.url, {
      ...options.init,
      signal: options.signal
        ? AbortSignal.any([
            options.signal,
            AbortSignal.timeout(options.timeoutMs),
          ])
        : AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return options.parse ? options.parse(data) : (data as T);
  } catch (cause) {
    throw new LlmUnavailableError(`${options.provider} request failed`, {
      cause,
    });
  }
}

export function generationTimeout(timeoutMs?: number): number {
  const configured = timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : GENERATION_TIMEOUT_MS;
}
