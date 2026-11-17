# MCP cross review: `05-mcp-server`

**Scope:** current uncommitted `apps/mcp`, the full `specs/mcp-tools/spec.md` (including appended requirements), `design.md`, and `tasks.md`. The API used for live probes was built from clean HEAD `d78d063` in `/tmp/p05-xr-wt`; no API code from the concurrently edited working tree was built or run. MCP build succeeded. `npm test` in `apps/mcp` passed: 9 files, 72 tests passed, 1 todo.

**Verdict:** all six MCP tools work on the real API for the tested happy paths. There is one implementation finding: when the API is down, MCP authentication fails before tool dispatch and returns an unstructured HTTP 502 instead of the specified retryable `UPSTREAM_UNAVAILABLE` tool result. OAuth end-to-end remains unverified because clean HEAD has no OAuth implementation.

## Requirement and scenario traceability

| Requirement / scenario | Implementation | Named MCP test | Real Taskory API probe |
|---|---|---|---|
| MCP endpoint/auth — missing token starts discovery | Pass: `/mcp` returns 401 challenge and makes no tool call. | `MCP endpoint and authentication > Missing token starts OAuth discovery` | Pass: exact `WWW-Authenticate: Bearer resource_metadata="http://localhost:3991/.well-known/oauth-protected-resource"`. |
| MCP endpoint/auth — zero-configuration OAuth connection | Not verifiable until phase 04 OAuth exists; this MCP build only advertises the resource metadata URL, and the route itself is 404. | `Zero-configuration connection exposes the exact discovery URL without serving metadata`; OAuth E2E test is todo | Not verifiable: clean HEAD API has no OAuth endpoints. |
| MCP endpoint/auth — per-user identity | Pass: bearer token is attached per incoming request and forwarded to API. | `MCP endpoint and authentication > Per-user identity` | Pass: user B could not see A’s record; B’s update and delete returned `NOT_FOUND`. |
| MCP endpoint/auth — expired/revoked token | Pass for API key revocation: validates each request and returns discovery challenge. | `Expired token`; `Token validation on every request`; `Returns a reconnect tool error when the API revokes a token during a tool call` | Pass: revoked key’s next request returned 401 with the exact challenge. OAuth refresh/expiry flow not verifiable. |
| Token forwarding — invalid token | Pass for rejected credentials. | `Token forwarding without shared credentials > Invalid token` | Pass: missing, garbage, oversized, and lowercase `bearer` with valid key were probed. Missing/invalid/oversized gave 401 + exact challenge; lowercase valid scheme succeeded. No MCP-owned credential is configured. |
| `log_activity` — title-only default date and created result | Pass. Optional date/timezone, description, reference URLs, tags, project are represented in schema. | `log_activity > Log with defaults` | Pass: tool returned created activity with today’s date and defaults. Date output observed as `2026-11-17`. |
| `list_activities` — inclusive range filters | Pass: passes date range to API. | `list_activities > Filter by range` | Pass: real API filtered range and returned expected rows. |
| `update_activity` + `delete_activity` — unknown/foreign ID | Pass: API `NOT_FOUND` becomes readable tool error. | `update_activity and delete_activity > Unknown id`; `Tool API error mapping > Maps NOT_FOUND to a readable tool error` | Pass: random UUID update returned `NOT_FOUND`; user B update/delete of user A’s activity both returned `NOT_FOUND`. Owner update and delete happy paths also passed. |
| `generate_report` — report returned for activity range | Pass: returns Markdown plus provider/model/count metadata. | `generate_report > Report returned`; `reports.test.ts > Returns Markdown with provider, model, and activityCount` | Pass: 5 activities returned Markdown (`# Report`) with metadata. The fake Ollama’s Markdown body is placeholder content. |
| Tool descriptions — discovery | Pass: exactly six tools; all expose descriptions and parameter schemas. | `Tool descriptions guide the agent > Tool discovery` | Pass: SDK `tools/list` showed all six names, descriptions, typed properties, and per-parameter documentation. |
| Async reports — >100 activities return job info | Pass. | `Asynchronous reports > Large report`; `reports.test.ts > Returns queued status and progress` | Pass: 120 activities returned 202-derived `queued` id/progress/instruction. |
| Async reports — completed report via `get_report` | Pass: returns Markdown when job is complete. | `Asynchronous reports > Completed report`; `reports.test.ts > Returns completed Markdown` | Pass: polling `get_report` went queued → running → completed and returned Markdown. |
| Token validation every request — revoked key’s next call | Pass: no validation cache. | `Token validation on every request`; `MCP endpoint and authentication > Expired token` | Pass: revocation was followed immediately by 401 and the same challenge. |
| Cross-origin preflight — no token, methods/headers exposed | Pass. `Access-Control-Expose-Headers` includes `WWW-Authenticate` and `Mcp-Session-Id`. | `Cross-origin preflight > Browser preflight` | Pass: OPTIONS returned 204; allowed methods and Authorization/Content-Type/MCP headers present; no token required. |
| Paginated listing — total/page/limit and next-page guidance | Pass. | `list_activities > More results than one page` | Pass: 120 records returned as 50/50/20; each page reported total 120 and page 1/2/3; pages 1 and 2 told the caller how to request the next page. |
| User-local date — timezone default / near-midnight behavior | Pass in implementation; uses IANA timezone and server-timezone fallback. | `log_activity > Log with defaults`; `User-local default date > Date near midnight`; `Rejects an invalid IANA timezone before the API call` | Pass: `Asia/Tokyo` and `America/Mexico_City` were accepted and returned the current local date (`2026-11-17`); invalid `Mars/Olympus` was rejected. The live clock put both valid zones on the same calendar date, so a differing-date edge was only verified by the named deterministic unit test, not the live API. |
| Upstream failures — network/timeout/5xx use retryable code | Partial: tool-repository mapping handles failures during a dispatched tool; initial per-request token validation handles the same outage at HTTP layer as bare 502. See finding below. | `Upstream failures are distinguishable > API unreachable returns UPSTREAM_UNAVAILABLE`; `API 500 returns UPSTREAM_UNAVAILABLE`; `API 503 returns UPSTREAM_UNAVAILABLE`; repository network/timeout/5xx tests | **Fail on total API outage:** after stopping API, valid-key `tools/call` got HTTP 502 body `Taskory API unavailable`, with no tool result/code or retry guidance. MCP `/health` remained 200 and process stayed up. |

## Tool coverage

| Tool | Implementation result | Named MCP tests | Live result |
|---|---|---|---|
| `log_activity` | Pass | `Log with defaults`; `Rejects an invalid IANA timezone before the API call`; tool input validation cases | Created with defaults; valid Tokyo/Mexico timezones accepted; invalid timezone rejected. |
| `list_activities` | Pass | `Filter by range`; `More results than one page` | Range filter and 120-row pagination passed. |
| `update_activity` | Pass | `Unknown id`; validation and API error mapping cases | Owner update passed; unknown and cross-user updates returned `NOT_FOUND`. |
| `delete_activity` | Pass | `Unknown id`; API error mapping cases (no named owner-success test) | Owner delete returned `{deleted:true}`; random/foreign ID returned `NOT_FOUND`. |
| `generate_report` | Pass with outage gap above | `Report returned`; `Large report`; API error mapping (`NO_ACTIVITIES`, `REPORT_IN_PROGRESS`, `VALIDATION_ERROR`) | 5-activity synchronous Markdown passed; 120-activity queued response passed; `NO_ACTIVITIES`, `UNKNOWN_PROVIDER`, and `REPORT_IN_PROGRESS` (including active ID) passed. Impossible date `2026-02-30` returned API `VALIDATION_ERROR`. |
| `get_report` | Pass | `Completed report`; report status/result cases | Completed async job returned Markdown. |

## Findings

### P2 — API outage during token validation bypasses `UPSTREAM_UNAVAILABLE`

**Reproduction:** start API and MCP as specified, then stop API and send a valid-key `tools/call` to `/mcp` (for example `log_activity`).

**Expected:** a retryable `UPSTREAM_UNAVAILABLE` tool error, per “Upstream failures are distinguishable / API unreachable”.

**Actual:** HTTP 502 with plain body `Taskory API unavailable`. `handleRequest` calls `validateToken` before creating the MCP server and catches non-401 failures by writing a bare 502; no MCP error code/result reaches the client. The service-level mapping cannot handle this path because no tool is dispatched.

**Impact:** agents cannot reliably classify/retry an API outage, despite the stated stable error contract. The MCP process itself remains healthy.

## Additional probes

- Raw JSON-RPC `tools/list` succeeded and exposed all six tools.
- Malformed JSON returned HTTP 400 and JSON-RPC `-32700` parse error.
- Body larger than 4 MiB returned HTTP 413.
- `GET /mcp` without auth returned 401; authorized GET with `Accept: text/event-stream` opened the SSE stream (no event within the 1 second observation window). Authorized `DELETE /mcp` returned 200.
- 150 simultaneous `list_activities` calls distributed across three personal API keys completed with 0 tool errors.
- 1,000 sequential tool calls completed. File descriptors rose during concurrency (30 → 320) and returned to 29; RSS rose from about 107 MiB to 178 MiB and plateaued during the final 300 sampled calls; heap fluctuated with GC. This did not show continuing descriptor growth, though RSS remained resident at the higher plateau.
- MCP stdout capture contained no `tk_` token strings after authenticated requests.
- `REPORT_NOT_RETRYABLE` was not applicable: no retry tool exists in this MCP surface. `LLM_UNAVAILABLE` and `RANGE_TOO_LARGE` are covered by named fake-API tests but were not forced against the live fake Ollama/API combination.

## Not verifiable until phase 04 OAuth exists

- OAuth authorization-code/PKCE flow from only the MCP URL, including client registration and redirect handling.
- OAuth access-token identity/expiry/refresh behavior against the real API; the live API only supplied personal API keys for this review.
- OAuth protected-resource metadata discovery served by the API and consumed end to end by an OAuth-capable MCP client.
