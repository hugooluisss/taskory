import type { LlmProvider } from "../types/llm-provider";
import { buildConsolidationPrompt } from "./consolidation.prompt";
import { completeStructuredOutput } from "./chunk-evaluation";
import {
  maxConsolidationChars,
  MAX_MEMORY_HIGHLIGHTS,
  MAX_CONSOLIDATION_LEVELS,
} from "./report-constants";
import { ReportCancelledError } from "../errors/report-cancelled.error";
import type { MemoryChunk } from "./report-memory";
import { buildFinalReportPrompt } from "./final-report.prompt";
import { InvalidLlmOutputError } from "../errors/invalid-llm-output.error";
import type { ReportTotals } from "./report-memory";
import type { ReportStyle } from "./report-styles";
import type { ReportProject } from "./report-options";

export async function consolidateMemory(
  memory: MemoryChunk[],
  provider: LlmProvider,
  model: string,
  language: "es" | "en",
  signal?: AbortSignal,
  finalOptions?: {
    totals: ReportTotals;
    from: string;
    to: string;
    projects?: ReportProject[];
    style: ReportStyle;
    customPrompt?: string;
  },
): Promise<{
  memory: MemoryChunk[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> {
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  const maxChars = maxConsolidationChars(provider.id);
  let current = memory.map((chunk) =>
    trimOversizedChunk(chunk, language, maxChars),
  );
  for (let level = 0; level < MAX_CONSOLIDATION_LEVELS; level += 1) {
    if (fitsFinalPrompt(current, language, maxChars, finalOptions))
      return { memory: current, promptTokens, completionTokens, totalTokens };
    const groups = groupMemory(current, language, maxChars);
    const result: MemoryChunk[] = [];
    for (const [index, group] of groups.entries()) {
      if (signal?.aborted) throw new ReportCancelledError();
      let consolidated: Awaited<ReturnType<typeof consolidateGroup>>;
      try {
        consolidated = await consolidateGroup(
          group,
          index,
          provider,
          model,
          language,
          signal,
          maxChars,
        );
      } catch (error) {
        const usage = usageOf(error);
        throw Object.assign(
          error instanceof Error ? error : new Error(String(error)),
          {
            promptTokens: promptTokens + usage.promptTokens,
            completionTokens: completionTokens + usage.completionTokens,
            totalTokens: totalTokens + usage.totalTokens,
          },
        );
      }
      totalTokens += consolidated.totalTokens;
      promptTokens += consolidated.promptTokens;
      completionTokens += consolidated.completionTokens;
      result.push(consolidated.chunk);
    }
    if (
      !result.length ||
      (result.length >= current.length &&
        countHighlights(result) >= countHighlights(current))
    )
      throw Object.assign(
        new InvalidLlmOutputError(
          "Report memory cannot fit within the prompt budget",
        ),
        { promptTokens, completionTokens, totalTokens },
      );
    current = result.map((chunk) =>
      trimOversizedChunk(chunk, language, maxChars),
    );
  }
  if (!fitsFinalPrompt(current, language, maxChars, finalOptions))
    throw Object.assign(
      new InvalidLlmOutputError(
        "Report memory cannot fit within the prompt budget",
      ),
      { promptTokens, completionTokens, totalTokens },
    );
  return { memory: current, promptTokens, completionTokens, totalTokens };
}

function usageOf(error: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof error !== "object" || error === null)
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const value = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0
      ? Number(candidate)
      : 0;
  return {
    promptTokens: value((error as { promptTokens?: unknown }).promptTokens),
    completionTokens: value(
      (error as { completionTokens?: unknown }).completionTokens,
    ),
    totalTokens: value((error as { totalTokens?: unknown }).totalTokens),
  };
}

function fitsFinalPrompt(
  memory: MemoryChunk[],
  language: "es" | "en",
  maxChars: number,
  options?: {
    totals: ReportTotals;
    from: string;
    to: string;
    projects?: ReportProject[];
    style: ReportStyle;
    customPrompt?: string;
  },
): boolean {
  if (!options) return countHighlights(memory) <= MAX_MEMORY_HIGHLIGHTS;
  const prompt = buildFinalReportPrompt({ ...options, memory, language });
  return serializedPromptSize(prompt) <= maxChars;
}

function serializedPromptSize(prompt: {
  system: string;
  prompt: string;
}): number {
  return prompt.system.length + prompt.prompt.length;
}

function trimOversizedChunk(
  chunk: MemoryChunk,
  language: "es" | "en",
  maxChars: number,
): MemoryChunk {
  const promptSize = serializedPromptSize(
    buildConsolidationPrompt([chunk], language),
  );
  if (promptSize <= maxChars) return chunk;
  const kept: MemoryChunk["highlights"] = [];
  const candidates = chunk.highlights
    .map((highlight, index) => ({ highlight, index }))
    .sort(
      (a, b) =>
        Number(b.highlight.impact === "high") -
          Number(a.highlight.impact === "high") || a.index - b.index,
    )
    .map(({ highlight }) => highlight);
  let full = false;
  for (const highlight of candidates) {
    if (full) continue;
    const candidate = { ...chunk, highlights: [...kept, highlight] };
    if (
      serializedPromptSize(buildConsolidationPrompt([candidate], language)) >
      maxChars
    ) {
      full = true;
      continue;
    }
    kept.push(highlight);
  }
  const droppedHighlights = chunk.highlights.length - kept.length;
  return {
    ...chunk,
    highlights: kept,
    droppedHighlights,
    summary: `${chunk.summary} [${droppedHighlights} highlights dropped to fit prompt budget]`,
  };
}

function countHighlights(memory: MemoryChunk[]): number {
  return memory.reduce((total, chunk) => total + chunk.highlights.length, 0);
}

function groupMemory(
  memory: MemoryChunk[],
  language: "es" | "en",
  maxChars: number,
): MemoryChunk[][] {
  const groups: MemoryChunk[][] = [];
  let group: MemoryChunk[] = [];
  let count = 0;
  for (const chunk of memory) {
    const candidate = [...group, chunk];
    if (
      group.length > 0 &&
      (count + chunk.highlights.length > MAX_MEMORY_HIGHLIGHTS ||
        serializedPromptSize(buildConsolidationPrompt(candidate, language)) >
          maxChars)
    ) {
      groups.push(group);
      group = [];
      count = 0;
    }
    group.push(chunk);
    count += chunk.highlights.length;
  }
  if (group.length > 0) {
    groups.push(group);
  }
  return groups;
}

async function consolidateGroup(
  chunks: MemoryChunk[],
  index: number,
  provider: LlmProvider,
  model: string,
  language: "es" | "en",
  signal?: AbortSignal,
  maxChars = maxConsolidationChars(provider.id),
): Promise<{
  chunk: MemoryChunk;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> {
  const allowed = new Map(
    chunks
      .flatMap((chunk) => chunk.highlights)
      .map((highlight) => [highlight.activityId, highlight]),
  );
  const prompt = buildConsolidationPrompt(chunks, language);
  if (serializedPromptSize(prompt) > maxChars)
    throw new InvalidLlmOutputError(
      "Consolidation group exceeds the prompt budget",
    );
  const evaluation = await completeStructuredOutput(
    provider,
    model,
    prompt,
    allowed,
    signal,
  );
  return {
    chunk: {
      chunkIndex: index,
      dateFrom: chunks[0].dateFrom,
      dateTo: chunks[chunks.length - 1].dateTo,
      activityCount: chunks.reduce(
        (total, chunk) => total + chunk.activityCount,
        0,
      ),
      summary: evaluation.summary,
      highlights: evaluation.highlights,
    },
    promptTokens: evaluation.promptTokens,
    completionTokens: evaluation.completionTokens,
    totalTokens: evaluation.totalTokens,
  };
}
