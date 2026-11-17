import type { LlmProvider } from "../types/llm-provider";
import { OllamaProvider } from "../providers/ollama.provider";
import { DeepSeekProvider } from "../providers/deepseek.provider";
export type ProviderFactory = () => LlmProvider;

export const providerRegistry: Record<string, ProviderFactory> = {
  ollama: () => new OllamaProvider(),
  deepseek: () => new DeepSeekProvider(),
};
