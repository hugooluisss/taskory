export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_grant"
  | "invalid_client"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "access_denied"
  | "invalid_target"
  | "invalid_scope";

export class OAuthError extends Error {
  constructor(
    readonly error: OAuthErrorCode,
    readonly description: string,
    readonly httpStatus: number,
  ) {
    super(description);
    this.name = "OAuthError";
  }
}
