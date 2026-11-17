export class InvalidLlmOutputError extends Error {
  constructor(
    message = "Provider returned invalid structured output",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InvalidLlmOutputError";
  }
}
