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
    this.defaultModel = options.defaultModel ?? process.env.DEFAULT_LLM_MODEL;
  }

  async listProviders(): Promise<
    { id: string; defaultModel: string; available: boolean }[]
  > {
    return Promise.all(
      Object.values(this.providers).map(async (provider) => ({
        id: provider.id,
        defaultModel: provider.defaultModel,
        available: await provider.isAvailable().catch(() => false),
      })),
    );
  }

  hasProvider(id = this.defaultProvider): boolean {
    return Object.hasOwn(this.providers, id);
  }

  async generate(
    options: ReportOptions,
  ): Promise<{ markdown: string; provider: string; model: string }> {
    const providerId = options.provider ?? this.defaultProvider;
    const provider = this.providers[providerId];
    if (!provider) {
      throw new UnknownProviderError(providerId);
    }

    const configuredDefaultModel =
      providerId === this.defaultProvider ? this.defaultModel : undefined;
    const model =
      options.model ?? configuredDefaultModel ?? provider.defaultModel;
    const { system, prompt } = buildReportPrompt({
      ...options,
      style: options.style ?? "summary",
    });

    try {
      const markdown = await provider.complete({ system, prompt, model });
      if (!markdown.trim()) {
        throw new Error("Provider returned empty content");
      }
      return { markdown, provider: provider.id, model };
    } catch (cause) {
      throw new LlmUnavailableError(`${provider.id} completion failed`, {
        cause,
      });
    }
  }

  async evaluateChunk(options: {
    activities: (ReportOptions["activities"][number] & { id: string })[];
    language: "es" | "en";
    provider?: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<ChunkEvaluation> {
    const { provider, model } = this.resolveProvider(
      options.provider,
      options.model,
    );
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
    provider?: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{ markdown: string; provider: string; model: string }> {
    const { provider, model } = this.resolveProvider(
      options.provider,
      options.model,
    );
    const memory = await consolidateMemory(
      options.memory,
      provider,
      model,
      options.language,
      options.signal,
      options,
    );
    const prompt = buildFinalReportPrompt({ ...options, memory });
    try {
      if (options.signal?.aborted) throw new ReportCancelledError();
      const markdown = await provider.complete({
        ...prompt,
        model,
        signal: options.signal,
      });
      if (!markdown.trim()) {
        throw new Error("Provider returned empty content");
      }
      return { markdown, provider: provider.id, model };
    } catch (cause) {
      if (options.signal?.aborted || cause instanceof ReportCancelledError)
        throw new ReportCancelledError();
      throw new LlmUnavailableError(`${provider.id} completion failed`, {
        cause,
      });
    }
  }

  private resolveProvider(
    providerId?: string,
    requestedModel?: string,
  ): { provider: LlmProvider; model: string } {
    const id = providerId ?? this.defaultProvider;
    const provider = this.providers[id];
    if (!provider) {
      throw new UnknownProviderError(id);
    }
    const configuredModel =
      id === this.defaultProvider ? this.defaultModel : undefined;
    return {
      provider,
      model: requestedModel ?? configuredModel ?? provider.defaultModel,
    };
  }
}
