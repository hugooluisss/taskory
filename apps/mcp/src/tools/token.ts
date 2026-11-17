export function bearerToken(extra: {
  requestInfo?: { headers: Record<string, string | string[] | undefined> };
}): string {
  const authorization = extra.requestInfo?.headers.authorization;
  return typeof authorization === "string"
    ? authorization.replace(/^Bearer\s+/i, "")
    : "";
}
