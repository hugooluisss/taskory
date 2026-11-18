import type { CompleteInput, Fetch, LlmProvider } from "../types/llm-provider";
import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import { fetchJson, generationTimeout } from "./http-json";

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface DeepSeekProviderOptions {
  fetcher?: Fetch;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class DeepSeekProvider implements LlmProvider {
  readonly id = "deepseek";
  readonly defaultModel: string;
  private readonly fetcher: Fetch;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly url = "https://api.deepseek.com/chat/completions";

  constructor(options: DeepSeekProviderOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.defaultModel = options.model ?? "deepseek-flash";
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
    if (!this.apiKey) {
      throw new LlmUnavailableError("DeepSeek API key is missing");
    }
    return fetchJson({
      fetcher: this.fetcher,
      url: this.url,
      init: {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: input.model ?? this.defaultModel,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
          ...(input.json ? { response_format: { type: "json_object" } } : {}),
        }),
      },
      timeoutMs: this.timeoutMs,
      provider: this.id,
      signal: input.signal,
      parse: (data) => {
        const content = (data as DeepSeekResponse).choices?.[0]?.message
          ?.content;
        if (typeof content !== "string" || (!input.json && !content.trim())) {
          throw new Error("Invalid DeepSeek response");
        }
        const response = data as DeepSeekResponse;
        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        return {
          text: content,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens:
              response.usage?.total_tokens ?? promptTokens + completionTokens,
          },
        };
      },
    });
  }

  private headers(): HeadersInit {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }
}
