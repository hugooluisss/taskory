export class ActiveReportExistsError extends Error {
  constructor(options?: ErrorOptions) {
    super("An active report already exists for this user", options);
    this.name = "ActiveReportExistsError";
  }
}
