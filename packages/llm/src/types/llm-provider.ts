export interface CompleteInput {
  system: string;
  prompt: string;
  model?: string;
}

export interface LlmProvider {
  id: string;
  defaultModel: string;
  isAvailable(): Promise<boolean>;
  complete(input: CompleteInput): Promise<string>;
}
export type Fetch = typeof fetch;
