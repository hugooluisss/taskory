import type { CompleteInput, Fetch, LlmProvider } from "../types/llm-provider";
import { LlmUnavailableError } from "../errors/llm-unavailable.error";
import {
  AVAILABILITY_TIMEOUT_MS,
  fetchJson,
  generationTimeout,
} from "./http-json";

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
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
    this.defaultModel = options.model ?? "deepseek-chat";
    this.timeoutMs = generationTimeout(options.timeoutMs);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    try {
      await fetchJson({
        fetcher: this.fetcher,
        url: this.url,
        init: {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            model: this.defaultModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        },
        timeoutMs: AVAILABILITY_TIMEOUT_MS,
        provider: this.id,
      });
      return true;
    } catch {
      return false;
    }
  }

  async complete(input: CompleteInput): Promise<string> {
    if (!this.apiKey) {
      throw new LlmUnavailableError("DeepSeek API key is missing");
    }
    return fetchJson<string>({
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
        }),
      },
      timeoutMs: this.timeoutMs,
      provider: this.id,
      parse: (data) => {
        const content = (data as DeepSeekResponse).choices?.[0]?.message
          ?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("Invalid DeepSeek response");
        }
        return content;
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
