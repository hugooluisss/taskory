# Taskory API contract (v1)

Taskory stores a user's daily work activities and generates AI reports from them. Multi-user. Languages: es / en.

## Repo layout (each agent owns its folder; no root workspace, each app has its own package.json)
- `apps/api` — NestJS + TypeScript + SQLite (TypeORM). Port 3000, global prefix `/api/v1`.
- `packages/llm` — dependency-free TS lib: `LlmProvider` interface, `OllamaProvider`, `DeepSeekProvider`, `ReportGenerator`. Consumed by the api as `"@taskory/llm": "file:../../packages/llm"`.
- `apps/mcp` — MCP server (streamable HTTP, port 3100, path `MCP_PATH`, default `/mcp`). Talks to the API over REST only.
- `apps/web` — Angular (latest), es/en runtime switch.
- `bruno/taskory` — Bruno collection, one `.bru` per endpoint, env files `local` and `server`.
- Docker comes later (separate task).

## Conventions
- Auth header: `Authorization: Bearer <token>`. Token is either a JWT (web login) or a personal API key (`tk_...`, used by MCP). Both resolve to a user.
- Every query is scoped to the authenticated user. A user can never read or modify another user's data (return 404, not 403).
- Dates are `YYYY-MM-DD` strings. Timestamps ISO-8601 UTC.
- Errors: `{ "statusCode": number, "code": "SNAKE_CASE_CODE", "message": string }`. `message` is localized via `Accept-Language` (`es` | `en`, default `en`); `code` is stable.
- Paginated list endpoints (activities) return `{ "items": [], "total": number, "page": number, "limit": number }`; query `page` (default 1), `limit` (default 50, max 200). Small bounded lists (api-keys, connected-apps, report providers) return a plain array.
- A user can have at most 20 active API keys (409 `API_KEY_LIMIT` beyond that).
- Passwords: argon2 or bcrypt. Never log secrets. API keys are stored hashed; plaintext shown only once at creation.
- Config via env vars: `JWT_SECRET`, `DATABASE_PATH`, `OLLAMA_BASE_URL`, `DEEPSEEK_API_KEY`, `DEFAULT_LLM_PROVIDER`, `DEFAULT_LLM_MODEL`.

## Activity
```json
{
  "id": "uuid",
  "date": "2026-11-16",
  "title": "string (required, 1-200)",
  "description": "string | null",
  "referenceUrls": ["https://..."],
  "tags": ["string"],
  "project": "string | null",
  "createdAt": "...", "updatedAt": "..."
}
```
`date` and `title` required. `referenceUrls` valid URLs, max 20. `tags` max 20, trimmed, lowercased, deduplicated.

## Endpoints (prefix `/api/v1`)

| Method | Path | Auth | Body / query | Response |
|---|---|---|---|---|
| GET | /health | none | — | 200 `{status:"ok"}` |
| POST | /auth/register | none | `{email, password(min 8), name}` | 201 `{token, user}` |
| POST | /auth/login | none | `{email, password}` | 200 `{token, user}` |
| GET | /auth/me | yes | — | 200 `user {id,email,name,language}` |
| PATCH | /auth/me | yes | `{name?, language?: "es"|"en"}` | 200 `user` |
| GET | /api-keys | yes | — | 200 `[{id,name,prefix,createdAt,lastUsedAt}]` |
| POST | /api-keys | yes | `{name}` | 201 `{id,name,key}` (key shown once) |
| DELETE | /api-keys/:id | yes | — | 204 |
| GET | /activities | yes | `from,to,project,tag,q,page,limit` | 200 list, ordered date desc, createdAt desc |
| POST | /activities | yes | Activity without id/timestamps | 201 Activity |
| GET | /activities/:id | yes | — | 200 Activity |
| PATCH | /activities/:id | yes | partial Activity | 200 Activity |
| DELETE | /activities/:id | yes | — | 204 |
| GET | /activities/meta | yes | — | 200 `{projects:[], tags:[]}` distinct values of the user |
| GET | /reports/providers | yes | — | 200 `[{id:"ollama",defaultModel,available}]` |
| POST | /reports | yes | `{from,to,project?,tags?,language:"es"|"en",provider?,model?,style?:"summary"|"detailed"}` | 200 `{markdown, provider, model, activityCount}` |

Notes:
- `/activities/meta` must be declared before `/activities/:id`.
- `POST /reports` body: `from`, `to` (calendar dates, `from <= to`), `project?`, `tags?` (max 20; an activity matches if it has ANY of them, tags are normalized like on activity writes), `language` (`es`|`en`), `provider?`, `model?` (max 100 chars), `style?`. The provider is validated first: 400 `UNKNOWN_PROVIDER`. Then 400 `VALIDATION_ERROR` (inverted range), 422 `NO_ACTIVITIES`, 422 `RANGE_TOO_LARGE` (more than 300 activities in this phase; raised by change 03b), 502 `LLM_UNAVAILABLE` (provider down, timeout, HTTP error, invalid or EMPTY output). The provider is never called on 4xx.
- `DEFAULT_LLM_MODEL` applies only when the resolved provider is the default provider; otherwise the provider's own default model is used.
- Rate-limit `/auth/*` (e.g. @nestjs/throttler).

## OAuth for MCP clients (phase 04)
The API is the OAuth 2.1 authorization server (public clients, PKCE S256 only, dynamic registration). Outside the `/api/v1` prefix: `GET /.well-known/oauth-authorization-server`, `GET /.well-known/oauth-protected-resource` and its resource path-suffixed URL, `POST /oauth/register`, `GET /oauth/authorize`, `POST /oauth/token`, `POST /oauth/revoke`. Under the prefix: `GET /oauth/requests/:id`, `POST /oauth/requests/:id/decision`, `GET /connected-apps`, `DELETE /connected-apps/:id`. Consent UI lives in the web app at `/oauth/consent`. Env: `PUBLIC_URL` and `MCP_PATH` (default `/mcp`; must start with `/` and have no trailing slash, query or fragment). Tokens are opaque (`to_` access, `tr_` refresh) and hashed. Full behavior: `openspec/changes/04-mcp-oauth`.

## MCP tools (apps/mcp)
Auth: OAuth access token (primary, zero-config for users) or personal API key `tk_...` (advanced) as `Authorization: Bearer ...`; the MCP forwards it to the API per request (multi-user, no shared credential). Without a valid token it answers 401 with `WWW-Authenticate: Bearer resource_metadata=...`.
- `log_activity {date?(default today), title, description?, referenceUrls?, tags?, project?}`
- `list_activities {from?, to?, project?, tag?, q?, limit?}`
- `update_activity {id, ...partial}`
- `delete_activity {id}`
- `generate_report {from, to, project?, language?, provider?, model?}`
Env: `TASKORY_API_URL`.

## Architecture (mandatory)
Every app follows controller -> service -> repository.
- API: controller handles the request/response only; service holds business rules; repository is the only layer touching the DB. No controller->repository calls, no DB access in services outside repositories.
- Web: component (controller) controls the view, never uses HttpClient; service holds rules; repository is the only layer calling the API.
- MCP: tool handler -> service -> API REST client (repository).
- packages/llm: ReportGenerator is the service, providers are repositories.

## Rules for all agents
- Do NOT run `git commit`/`git add`/push. Leave changes in the working tree.
- Only touch your own folder. Tell the architect if the contract needs a change; do not change it.
- Include tests (unit/e2e as appropriate) and make sure build and tests pass before reporting done.
- Keep it simple: no speculative abstractions.
