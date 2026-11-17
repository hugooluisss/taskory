# Security cross review: 04-mcp-oauth

## How this review was done

The planned offensive review by a Codex agent (`gpt-6.1-terra`) was blocked by the model provider's cybersecurity safeguard (the agent answered "We take extra care with some cybersecurity requests"). The block was not worked around. The architect ran the same class of checks directly, against the application's own code on localhost only (port 3985, temporary SQLite file, rate limits raised through environment variables), with the script `tools/oauth-security-probe.mjs` (copied from the architect's scratch probe; see task 5c.2).

## Results (59 checks: 51 passed, 8 failed at first run)

| Area | Result |
|---|---|
| Issuer and metadata follow `PUBLIC_URL`, not a spoofed `Host` header | OK |
| Registration rejects: `javascript:`, `JavaScript:`, `data:`, `vbscript:`, `file:`, `http://evil.com`, `localhost.evil.com`, `127.0.0.1.evil.com`, `[::1]@evil.com`, `good.com@evil.com`, fragments, wildcards, userinfo, `0.0.0.0`, decimal/hex IPs, `127.1`, empty host, 2 k+ chars, `java\tscript:`, `abc:def` | OK |
| Registration rejects URIs containing CR, LF or TAB inside the string | **FAIL (F1)** |
| Registration accepts: https host, loopback http with port, `[::1]`, custom scheme with a dot | OK |
| `/oauth/authorize` requires an EXACT `redirect_uri` match (trailing slash, upper-case scheme/host, query, explicit default port, path case all rejected, no `Location`) | OK |
| `state` with `&`, `#`, CRLF cannot inject parameters or headers | OK |
| PKCE: missing, `plain`, short or non-base64url challenge rejected; wrong verifier `invalid_grant`; short verifier `invalid_request` | OK |
| 50 concurrent exchanges of one code: exactly one 200, the issued access token is revoked afterwards | OK |
| 30 concurrent refreshes of one token: at most one 200; refresh with another `client_id` fails | OK |
| 20 concurrent decisions on one request: exactly one succeeds | OK |
| Decision rejects OAuth access token, API key and no token (401) | OK |
| Decision rejects `approve: "true"` (string) | **FAIL (F2)**: answered 201 |
| Decision rejects `approve` = 1, null, [], {}, missing | Not conclusive: the request was already consumed by the F2 case (404); to be retested after the fix |
| Repeated form parameters, `__proto__` JSON, `text/plain` bodies: 4xx, no 500 | OK |
| CORS: wildcard without credentials on metadata; no CORS header on `/api/v1/*` or `/oauth/authorize` | OK |
| Database inspection: no plaintext token or code in any `oauth_*` table (0 hits, 16 tokens) | OK |
| Server log inspection: no `to_`/`tr_` tokens, codes or verifiers | OK |

## Findings

### F1 (medium): registered redirect URIs may contain control characters

`validateRedirectUri` parses with `new URL`, which silently removes tab, CR and LF, so `https://x.com/cb\r\nX: y` is accepted and stored raw. Redirect building uses the parsed form, so no header injection was observed, but the stored value and the exact-match comparison use different strings. Fix: reject any whitespace or control character (`/[\u0000- \u007f]/`) in the raw string before parsing; test each.

### F2 (medium): `approve` accepts the string "true"

The decision body is not strictly typed. Fix: `RequestDecisionDto` with a strict boolean (no implicit conversion), 400 `VALIDATION_ERROR` otherwise; test string, number, null, array, object and missing.

## Not verified

- Token and code expiry with the real clock (covered with the injectable clock in the e2e suite).
- Purge behaviour against crafted expired rows (covered by repository tests).
- Resource indicators (RFC 8707) and audience binding of tokens: recommendation pending from the design review.
- Real OAuth client behaviour (task 5.3).
