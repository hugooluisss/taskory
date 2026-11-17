export class ReportNotFoundForMemoryError extends Error {
  constructor(options?: ErrorOptions) {
    super("The report for this memory row no longer exists", options);
    this.name = "ReportNotFoundForMemoryError";
  }
}
