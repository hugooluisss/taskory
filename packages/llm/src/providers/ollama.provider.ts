import type { CompleteInput, Fetch, LlmProvider } from "../types/llm-provider";
import { fetchJson, generationTimeout } from "./http-json";

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaProviderOptions {
  fetcher?: Fetch;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class OllamaProvider implements LlmProvider {
  readonly id = "ollama";
  readonly defaultModel: string;
  private readonly fetcher: Fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaProviderOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl =
      options.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      "http://localhost:11434";
    this.defaultModel = options.model ?? "llama3.2";
    this.timeoutMs = generationTimeout(options.timeoutMs);
  }

  async complete(
    input: CompleteInput,
  ): Promise<{
    text: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    return fetchJson({
      fetcher: this.fetcher,
      url: `${this.baseUrl}/api/chat`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model ?? this.defaultModel,
          stream: false,
          ...(input.json ? { format: "json" } : {}),
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      },
      timeoutMs: this.timeoutMs,
      provider: this.id,
      signal: input.signal,
      parse: (data) => {
        const content = (data as OllamaResponse).message?.content;
        if (typeof content !== "string" || (!input.json && !content.trim())) {
          throw new Error("Invalid Ollama response");
        }
        const response = data as OllamaResponse;
        return {
          text: content,
          usage: {
            promptTokens: response.prompt_eval_count ?? 0,
            completionTokens: response.eval_count ?? 0,
            totalTokens:
              (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
          },
        };
      },
    });
  }
}
