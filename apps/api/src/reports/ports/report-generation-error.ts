export class ReportGenerationError extends Error {
  constructor(
    readonly code: "LLM_UNAVAILABLE" | "INVALID_LLM_OUTPUT" | "CANCELLED",
    readonly usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } = { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ReportGenerationError";
  }
}
