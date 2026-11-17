import { OAUTH_REDIRECT_URI_MAX_LENGTH } from "./constants";

const DENIED_SCHEMES = new Set([
  "javascript",
  "data",
  "file",
  "vbscript",
  "about",
  "blob",
  "ftp",
]);

export type RedirectUriValidation =
  | { valid: true }
  | {
      valid: false;
      reason: string;
    };

export function validateRedirectUri(uri: string): RedirectUriValidation {
  if (/[\u0000-\u0020\u007f-\u009f]/.test(uri))
    return invalid("Whitespace and control characters are not allowed");
  if (uri.length > OAUTH_REDIRECT_URI_MAX_LENGTH)
    return invalid("URI is too long");
  if (uri.includes("#")) return invalid("Fragments are not allowed");
  if (uri.includes("*")) return invalid("Wildcards are not allowed");

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return invalid("URI is not parseable");
  }

  if (parsed.username || parsed.password || /\/\/[^/]*@/.test(uri)) {
    return invalid("Userinfo is not allowed");
  }

  if (parsed.protocol === "https:") {
    return getAuthority(uri) ? { valid: true } : invalid("Host is required");
  }
  if (parsed.protocol === "http:") {
    const authority = getAuthority(uri);
    if (!authority) return invalid("Host is required");
    return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(authority)
      ? { valid: true }
      : invalid("HTTP is allowed only for loopback hosts");
  }

  const scheme = parsed.protocol.slice(0, -1);
  if (
    !/^[a-z][a-z0-9+.-]*$/.test(scheme) ||
    DENIED_SCHEMES.has(scheme) ||
    !(scheme.includes(".") || scheme.includes("-") || scheme.length >= 4)
  ) {
    return invalid("Custom scheme is not allowed");
  }
  return { valid: true };
}

export function matchesRegisteredRedirect(
  registered: string[],
  candidate: string,
): boolean {
  return registered.includes(candidate);
}

function invalid(reason: string): RedirectUriValidation {
  return { valid: false, reason };
}

function getAuthority(uri: string): string | null {
  return uri.match(/^https?:\/\/([^/?#]*)/i)?.[1] || null;
}
