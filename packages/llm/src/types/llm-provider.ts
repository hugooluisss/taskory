export interface CompleteInput {
  system: string;
  prompt: string;
  model?: string;
  json?: boolean;
  signal?: AbortSignal;
}

export interface LlmProvider {
  id: string;
  defaultModel: string;
  complete(input: CompleteInput): Promise<{ text: string; usage: TokenUsage }>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
export type Fetch = typeof fetch;
