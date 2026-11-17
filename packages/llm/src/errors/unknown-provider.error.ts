export class UnknownProviderError extends Error {
  constructor(provider: string) {
    super(`Unknown LLM provider: ${provider}`);
    this.name = "UnknownProviderError";
  }
}
