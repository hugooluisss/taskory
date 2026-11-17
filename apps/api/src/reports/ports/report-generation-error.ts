export class ReportGenerationError extends Error {
  constructor(
    readonly code: "LLM_UNAVAILABLE" | "INVALID_LLM_OUTPUT" | "CANCELLED",
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ReportGenerationError";
  }
}
