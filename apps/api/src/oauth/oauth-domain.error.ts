export type OAuthRequestErrorReason =
  "not_found" | "expired" | "already_decided";

export class OAuthRequestNotFoundError extends Error {
  constructor(readonly reason: OAuthRequestErrorReason) {
    super(reason);
    this.name = "OAuthRequestNotFoundError";
  }
}
