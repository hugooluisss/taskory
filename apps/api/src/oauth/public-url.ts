import { OAUTH_PUBLIC_URL_DEFAULT } from "./constants";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getMcpResource(): string {
  return `${getPublicUrl()}/mcp`;
}

export function getPublicUrl(): string {
  const configured = process.env.PUBLIC_URL;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("PUBLIC_URL is required in production");
  }
  const value = configured || OAUTH_PUBLIC_URL_DEFAULT;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PUBLIC_URL must be an absolute HTTP(S) URL");
  }
  if (
    parsed.username ||
    parsed.password ||
    !["http:", "https:"].includes(parsed.protocol)
  ) {
    throw new Error(
      "PUBLIC_URL must be an absolute HTTP(S) URL without userinfo",
    );
  }
  if (process.env.NODE_ENV === "production") {
    if (
      parsed.protocol !== "https:" ||
      !["", "/"].includes(parsed.pathname) ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "In production PUBLIC_URL must be an HTTPS origin without path, query, or fragment",
      );
    }
  } else if (
    parsed.protocol === "http:" &&
    !LOOPBACK_HOSTS.has(parsed.hostname)
  ) {
    throw new Error(
      "HTTP PUBLIC_URL is allowed only for localhost, 127.0.0.1, or [::1]",
    );
  }
  return parsed.origin;
}
