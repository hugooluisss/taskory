export class ReportCancelledError extends Error {
  constructor() {
    super("Report generation was cancelled");
    this.name = "ReportCancelledError";
  }
}
