import type { IncomingMessage } from "node:http";

export function bearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return undefined;
  const match = /^Bearer ([^\s]{1,512})$/i.exec(authorization);
  if (!match || match[0] !== authorization) return undefined;
  return match[1];
}
