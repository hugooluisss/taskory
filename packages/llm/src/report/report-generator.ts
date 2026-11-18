import type { LlmProvider } from "../types/llm-provider";
import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import { UnknownProviderError } from "../errors/unknown-provider.error";
import { providerRegistry } from "../registry/provider-registry";
import { buildReportPrompt } from "./report-prompt";
import { buildChunkEvaluationPrompt } from "./chunk-evaluation.prompt";
import { buildFinalReportPrompt } from "./final-report.prompt";
import { completeStructuredOutput } from "./chunk-evaluation";
import { consolidateMemory } from "./memory-consolidator";
import { ReportCancelledError } from "../errors/report-cancelled.error";
import type {
  ChunkEvaluation,
  MemoryChunk,
  ReportTotals,
} from "./report-memory";
import type { ReportOptions } from "./report-options";
export interface ReportGeneratorOptions {
  providers?: Record<string, LlmProvider>;
  defaultProvider?: string;
  defaultModel?: string;
}

export class ReportGenerator {
  private readonly providers: Record<string, LlmProvider>;
  private readonly defaultProvider: string;
  private readonly defaultModel?: string;

  constructor(options: ReportGeneratorOptions = {}) {
    this.providers =
      options.providers ??
      Object.fromEntries(
        Object.entries(providerRegistry).map(([id, factory]) => [
          id,
          factory(),
        ]),
      );
    this.defaultProvider =
      options.defaultProvider ?? process.env.DEFAULT_LLM_PROVIDER ?? "ollama";
    this.defaultModel =
      options.defaultModel ??
      (process.env.DEFAULT_LLM_MODEL?.trim() || undefined);
  }

  hasProvider(): boolean {
    return Object.hasOwn(this.providers, this.defaultProvider);
  }

  configuration(): { provider: string; model: string } {
    const { provider, model } = this.resolveProvider();
    return { provider: provider.id, model };
  }

  async generate(
    options: ReportOptions,
  ): Promise<{
    markdown: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }> {
    const providerId = this.defaultProvider;
    const provider = this.providers[providerId];
    if (!provider) {
      throw new UnknownProviderError(providerId);
    }

    const configuredDefaultModel =
      providerId === this.defaultProvider ? this.defaultModel : undefined;
    const model = configuredDefaultModel ?? provider.defaultModel;
    const { system, prompt } = buildReportPrompt({
      ...options,
      style: options.style ?? "summary",
    });

    let usage = emptyUsage();
    try {
      const completion = await provider.complete({ system, prompt, model });
      usage = completion.usage;
      if (!completion.text.trim()) {
        throw new Error("Provider returned empty content");
      }
      return {
        markdown: completion.text,
        provider: provider.id,
        model,
        ...usage,
      };
    } catch (cause) {
      throw Object.assign(
        new LlmUnavailableError(`${provider.id} completion failed`, {
          cause,
        }),
        usage,
      );
    }
  }

  async evaluateChunk(options: {
    activities: (ReportOptions["activities"][number] & { id: string })[];
    language: "es" | "en";
    signal?: AbortSignal;
  }): Promise<ChunkEvaluation> {
    const { provider, model } = this.resolveProvider();
    const prompt = buildChunkEvaluationPrompt(
      options.activities,
      options.language,
    );
    const allowed = new Map(
      options.activities.map((activity) => [
        activity.id,
        {
          date: activity.date,
          title: activity.title,
          project: activity.project ?? null,
        },
      ]),
    );
    const evaluation = await completeStructuredOutput(
      provider,
      model,
      prompt,
      allowed,
      options.signal,
    );
    return { ...evaluation, provider: provider.id, model };
  }

  async writeFinal(options: {
    memory: MemoryChunk[];
    totals: ReportTotals;
    from: string;
    to: string;
    projects?: string[];
    language: "es" | "en";
    style: "summary" | "detailed";
    signal?: AbortSignal;
  }): Promise<{
    markdown: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }> {
    const { provider, model } = this.resolveProvider();
    let consolidated: Awaited<ReturnType<typeof consolidateMemory>>;
    try {
      consolidated = await consolidateMemory(
        options.memory,
        provider,
        model,
        options.language,
        options.signal,
        options,
      );
    } catch (error) {
      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        {
          ...tokenUsage(error),
        },
      );
    }
    const prompt = buildFinalReportPrompt({
      ...options,
      memory: consolidated.memory,
    });
    let finalUsage = emptyUsage();
    try {
      if (options.signal?.aborted) throw new ReportCancelledError();
      const completion = await provider.complete({
        ...prompt,
        model,
        signal: options.signal,
      });
      finalUsage = completion.usage;
      if (!completion.text.trim()) {
        throw new Error("Provider returned empty content");
      }
      return {
        markdown: completion.text,
        provider: provider.id,
        model,
        promptTokens: consolidated.promptTokens + finalUsage.promptTokens,
        completionTokens:
          consolidated.completionTokens + finalUsage.completionTokens,
        totalTokens: consolidated.totalTokens + finalUsage.totalTokens,
      };
    } catch (cause) {
      if (options.signal?.aborted || cause instanceof ReportCancelledError)
        throw new ReportCancelledError();
      throw Object.assign(
        new LlmUnavailableError(`${provider.id} completion failed`, {
          cause,
        }),
        {
          promptTokens:
            consolidated.promptTokens +
            finalUsage.promptTokens +
            tokenUsage(cause).promptTokens,
          completionTokens:
            consolidated.completionTokens +
            finalUsage.completionTokens +
            tokenUsage(cause).completionTokens,
          totalTokens:
            consolidated.totalTokens +
            finalUsage.totalTokens +
            tokenUsage(cause).totalTokens,
        },
      );
    }
  }

  private resolveProvider(): { provider: LlmProvider; model: string } {
    const id = this.defaultProvider;
    const provider = this.providers[id];
    if (!provider) {
      throw new UnknownProviderError(id);
    }
    const configuredModel =
      id === this.defaultProvider ? this.defaultModel : undefined;
    return {
      provider,
      model: configuredModel ?? provider.defaultModel,
    };
  }
}

function emptyUsage(): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function tokenUsage(error: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (typeof error !== "object" || error === null) return emptyUsage();
  const source = error as Partial<ReturnType<typeof emptyUsage>>;
  const value = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0
      ? Number(candidate)
      : 0;
  return {
    promptTokens: value(source.promptTokens),
    completionTokens: value(source.completionTokens),
    totalTokens: value(source.totalTokens),
  };
}
