import type { LlmProvider } from "../types/llm-provider";
import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import { UnknownProviderError } from "../errors/unknown-provider.error";
import { providerRegistry } from "../registry/provider-registry";
import { buildReportPrompt } from "./report-prompt";
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
}
