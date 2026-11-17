export class ApiError extends Error {
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    readonly code: string,
    readonly status: number,
    details: Record<string, unknown> = {},
  ) {
    super(code);
    this.details = Object.freeze({ ...details });
  }
}
