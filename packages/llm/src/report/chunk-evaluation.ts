import { InvalidLlmOutputError } from "../errors/invalid-llm-output.error";
import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import type { LlmProvider } from "../types/llm-provider";
import { INVALID_OUTPUT_RETRIES } from "./report-constants";
import { ReportCancelledError } from "../errors/report-cancelled.error";
import type { Highlight } from "./report-memory";
import { validateChunkOutput } from "./chunk-output-validator";

type AllowedMetadata = Pick<Highlight, "date" | "title" | "project">;

export async function completeStructuredOutput(
  provider: LlmProvider,
  model: string,
  prompt: { system: string; prompt: string },
  allowed: Map<string, AllowedMetadata>,
  signal?: AbortSignal,
): Promise<{ summary: string; highlights: Highlight[] }> {
  for (let attempt = 0; attempt <= INVALID_OUTPUT_RETRIES; attempt += 1) {
    if (signal?.aborted) throw new ReportCancelledError();
    let content: string;
    try {
      content = await complete(provider, model, prompt, signal);
    } catch (error) {
      if (signal?.aborted) throw new ReportCancelledError();
      if (attempt === INVALID_OUTPUT_RETRIES) {
        if (error instanceof InvalidLlmOutputError) throw error;
        throw error instanceof LlmUnavailableError
          ? error
          : new LlmUnavailableError(`${provider.id} completion failed`, {
              cause: error,
            });
      }
      continue;
    }
    const parsed = parseOutput(content, attempt);
    if (parsed) {
      const evaluation = validateChunkOutput(parsed, allowed);
      if (evaluation) {
        return {
          ...evaluation,
          highlights: enrichHighlights(evaluation.highlights, allowed),
        };
      }
    }
    if (attempt === INVALID_OUTPUT_RETRIES) {
      throw new InvalidLlmOutputError();
    }
  }
  throw new InvalidLlmOutputError();
}

async function complete(
  provider: LlmProvider,
  model: string,
  prompt: { system: string; prompt: string },
  signal?: AbortSignal,
): Promise<string> {
  try {
    return await provider.complete({ ...prompt, model, json: true, signal });
  } catch (cause) {
    if (cause instanceof LlmUnavailableError) {
      throw cause;
    }
    throw new LlmUnavailableError(`${provider.id} completion failed`, {
      cause,
    });
  }
}

function parseOutput(content: string, attempt: number): unknown | undefined {
  try {
    return JSON.parse(content);
  } catch (cause) {
    if (attempt === INVALID_OUTPUT_RETRIES) {
      throw new InvalidLlmOutputError("Provider returned invalid JSON", {
        cause,
      });
    }
    return undefined;
  }
}

function enrichHighlights(
  highlights: Pick<Highlight, "activityId" | "impact" | "reason">[],
  allowed: Map<string, AllowedMetadata>,
): Highlight[] {
  return highlights.map((highlight) => ({
    ...allowed.get(highlight.activityId)!,
    ...highlight,
  }));
}
