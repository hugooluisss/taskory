import type { LlmProvider } from "../types/llm-provider";
import { buildConsolidationPrompt } from "./consolidation.prompt";
import { completeStructuredOutput } from "./chunk-evaluation";
import {
  MAX_CONSOLIDATION_CHARS,
  MAX_MEMORY_HIGHLIGHTS,
  MAX_CONSOLIDATION_LEVELS,
} from "./report-constants";
import { ReportCancelledError } from "../errors/report-cancelled.error";
import type { MemoryChunk } from "./report-memory";
import { buildFinalReportPrompt } from "./final-report.prompt";
import { InvalidLlmOutputError } from "../errors/invalid-llm-output.error";
import type { ReportTotals } from "./report-memory";

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
    projects?: string[];
    style: "summary" | "detailed";
  },
): Promise<MemoryChunk[]> {
  let current = memory.map((chunk) => trimOversizedChunk(chunk, language));
  for (let level = 0; level < MAX_CONSOLIDATION_LEVELS; level += 1) {
    if (
      countHighlights(current) <= MAX_MEMORY_HIGHLIGHTS &&
      fitsFinalPrompt(current, language, finalOptions)
    )
      return current;
    const groups = groupMemory(current, language);
    const result: MemoryChunk[] = [];
    for (const [index, group] of groups.entries()) {
      if (signal?.aborted) throw new ReportCancelledError();
      result.push(
        await consolidateGroup(group, index, provider, model, language, signal),
      );
    }
    if (
      !result.length ||
      (result.length >= current.length &&
        countHighlights(result) >= countHighlights(current))
    )
      throw new InvalidLlmOutputError(
        "Report memory cannot fit within the prompt budget",
      );
    current = result.map((chunk) => trimOversizedChunk(chunk, language));
  }
  if (
    !fitsFinalPrompt(current, language, finalOptions) ||
    countHighlights(current) > MAX_MEMORY_HIGHLIGHTS
  )
    throw new InvalidLlmOutputError(
      "Report memory cannot fit within the prompt budget",
    );
  return current;
}

function fitsFinalPrompt(
  memory: MemoryChunk[],
  language: "es" | "en",
  options?: {
    totals: ReportTotals;
    from: string;
    to: string;
    projects?: string[];
    style: "summary" | "detailed";
  },
): boolean {
  if (!options) return countHighlights(memory) <= MAX_MEMORY_HIGHLIGHTS;
  const prompt = buildFinalReportPrompt({ ...options, memory, language });
  return serializedPromptSize(prompt) <= MAX_CONSOLIDATION_CHARS;
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
): MemoryChunk {
  const promptSize = serializedPromptSize(
    buildConsolidationPrompt([chunk], language),
  );
  if (promptSize <= MAX_CONSOLIDATION_CHARS) return chunk;
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
      MAX_CONSOLIDATION_CHARS
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
          MAX_CONSOLIDATION_CHARS)
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
): Promise<MemoryChunk> {
  const allowed = new Map(
    chunks
      .flatMap((chunk) => chunk.highlights)
      .map((highlight) => [highlight.activityId, highlight]),
  );
  const prompt = buildConsolidationPrompt(chunks, language);
  if (serializedPromptSize(prompt) > MAX_CONSOLIDATION_CHARS)
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
    chunkIndex: index,
    dateFrom: chunks[0].dateFrom,
    dateTo: chunks[chunks.length - 1].dateTo,
    activityCount: chunks.reduce(
      (total, chunk) => total + chunk.activityCount,
      0,
    ),
    summary: evaluation.summary,
    highlights: evaluation.highlights,
  };
}
