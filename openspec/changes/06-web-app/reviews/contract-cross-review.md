# 06-web-app contract cross review

Read-only review of `apps/web` against `docs/api-contract.md`, archived OpenSpec specs, and the working-tree API. Live checks used the API build and fake Ollama on ports 3984 and 3983. API build passed; web build passed; web tests passed (56 files, 184 tests).

## Repository method results

`PASS` means URL, verb, request shape, and declared response shape match the current API for the normal success path. Conditional response shapes and contract/API divergences are detailed below.

| Repository method | Web request | API / contract evidence | Result |
|---|---|---|---|
| Auth `register` | `POST /auth/register`, `{email,password,name}` | API DTO matches; API returns 201 `{token,user}`. Live 201. | PASS |
| Auth `login` | `POST /auth/login`, `{email,password}` | API DTO matches; returns 200 `{token,user}`. Live 200. | PASS |
| Auth `me` | `GET /auth/me` | Returns user fields `id,email,name,language`. Live 200, all required model fields. | PASS |
| Auth `updateMe` | `PATCH /auth/me`, `{name?,language?}` | DTO accepts same fields; returns user. Live 200. | PASS |
| Activities `list` | `GET /activities`; forwards `from,to,project,tag,q,page,limit` | Exact DTO query names; response `{items,total,page,limit}`. Live filtered request returned expected envelope. | PASS |
| Activities `get` | `GET /activities/:id` | API returns activity fields; live response also has extra `userId` absent from `Activity` model and contract. | PASS* |
| Activities `create` | `POST /activities`, `ActivityInput` | Fields match create DTO; live 201 with all model fields plus extra `userId`. | PASS* |
| Activities `update` | `PATCH /activities/:id`, partial `ActivityInput` | DTO fields match; live 200 with fields plus extra `userId`. | PASS* |
| Activities `delete` | `DELETE /activities/:id` | API returns 204; live 204. | PASS |
| Activities `meta` | `GET /activities/meta` | API returns `{projects,tags}`; live exact shape. | PASS |
| API keys `list` | `GET /api-keys` | Plain array; fields match `ApiKey`; live item has all declared fields. | PASS |
| API keys `create` | `POST /api-keys`, `{name}` | API returns 201 `{id,name,key}`; live exact shape. | PASS |
| API keys `revoke` | `DELETE /api-keys/:id` | API returns 204; live 204. | PASS |
| Reports `providers` | `GET /reports/providers` | Plain array of `{id,defaultModel,available}`; live items match. | PASS |
| Reports `create` | `POST /reports`, `ReportRequest`, observes full response | Request fields match DTO. API returns 200 for <=100 activities and 202 for >100; live 200 with 5 activities and 202 with 101. Service branches on status. | PASS |
| Reports `getJob` | `GET /reports/:id` | Completed response matched the declared model. Queued/running omit `markdown,provider,model,activityCount`; failed responses provide `error` with `message` too. `ReportJob` incorrectly requires terminal-only fields for every status and omits `error.message`. | FAIL |
| Reports `retryJob` | `POST /reports/:id/retry`, `{}` | API has no body fields and responds 202 with only `{id,status,progress}`. Repository claims full `ReportJob`; this cannot satisfy that model. Live retry of a completed job correctly returned 409 `REPORT_NOT_RETRYABLE`. | FAIL |
| Reports `deleteJob` | `DELETE /reports/:id` | API returns 204; controller and repository match. | PASS |
| OAuth requests `getRequest` | `GET /oauth/requests/:id` | URL/verb match. Live body includes `clientName,clientId,redirectUri,redirectHost,scope,accessDescription,expiresAt`; `ConsentRequest` omits required API field `accessDescription: "full-access"`. | FAIL |
| OAuth requests `decide` | `POST /oauth/requests/:id/decision`, `{approved}` | API `RequestDecisionDto` requires `{approve:boolean}`. Live repository-shaped `{approved:true}` returned 400 `VALIDATION_ERROR`; corrected `{approve:true}` returned 201 `{redirectUrl}`. Return typing is otherwise sufficient. | FAIL |
| Connected apps `list` | `GET /connected-apps` | API live item is `{id,clientName,createdAt,lastUsedAt}`. Model requires nonexistent `clientId` and omits `lastUsedAt`. | FAIL |
| Connected apps `disconnect` | `DELETE /connected-apps/:id` | API returns 204; live deletion returned 204. | PASS |

\* API serializes `userId` inside activities although both `docs/api-contract.md` and `Activity` omit it. The web model tolerates extra JSON properties, so this does not break these calls, but it is an API contract leak/divergence.

### Additional API/contract and OAuth checks

- `REPORT_IN_PROGRESS` is 409 and carries the active report identifier in the top-level `id` field, alongside `statusCode`, `code`, and `message`. The web interceptor preserves it in `ApiError.details.id`; `ReportsPage` reads it correctly. Live response confirmed this shape.
- Retry of a completed job is 409 `REPORT_NOT_RETRYABLE`, as specified. A successful retry response is the same minimal `{id,status,progress}` shape as enqueue, not a full status representation.
- OAuth registration is at `POST /oauth/register` outside `/api/v1`; it is a flow endpoint, not a method in these repositories. Authorization uses query fields `client_id`, `redirect_uri`, and `scope`; consent lookup itself correctly sends the request ID in the path, with client ID, redirect URI and scope carried in the returned object. Scope is `taskory`.
- API redirect URI registration rejects whitespace/control characters, overlong URIs, fragments, wildcards, userinfo, unsupported/unsafe schemes, and non-loopback HTTP. Authorization requires exact equality with a registered redirect URI. This is stricter than `ConsentPage.safeRedirect`: that page only checks protocol (and a nonempty host for HTTP(S)), not that the result's origin/host/path equals `request.redirectUri`. The page accepts a server response pointing at another host when the scheme is unchanged. This is a defense-in-depth validation gap (P2); the API currently constructs `redirectUrl` from the stored request redirect URI.
- Consent approve and deny both returned 201 with `{redirectUrl}` when sent the API's required `{approve}` body. Approval yielded `code,state,iss`; denial yielded `error=access_denied,state,iss`. Connected-app listing and delete were also exercised; delete returned 204.
- Activity metadata is exactly `{projects,tags}` and activity pagination is the expected envelope. Runtime activity objects have the undocumented extra `userId` described above.

## Translation audit

Checked static translation references in templates and TypeScript, including `ErrorMessageService` mappings, against shared translations and each feature scope's English and Spanish file. There are no missing referenced keys, no identical English/Spanish text entries, and no key parity failures. The `root` extraction candidate is a TypeScript `providedIn: 'root'` false positive, not a translation key.

### Unused translation entries (both locales)

- Shared: `auth.login`, `auth.register`, `common.cancel`, `common.confirm`, and `nav.activities`, `nav.consent`, `nav.label`, `nav.reports`, `nav.settings`.
- Activities scope: `add`, `allProjects`, `applyFilters`, `clearFilters`, `date`, `description`, `edit`, `editActivity`, `emptyFilteredMessage`, `emptyMessage`, `emptyTitle`, `filters`, `from`, `hideDescription`, `hideDetails`, `invalidRange`, `loadError`, `loading`, `moreDetails`, `newActivity`, `noResults`, `pageDescription`, `pageTitle`, `project`, `quickTitle`, `referenceUrls`, `required`, `resultCount`, `retry`, `save`, `search`, `showDescription`, `tag`, `tags`, `title`, `titleTooLong`, `to`.
- Consent scope: `unknown`.
- Reports scope: `errors.LLM_UNAVAILABLE`, `errors.NO_ACTIVITIES`, `errors.RANGE_TOO_LARGE`, `errors.REPORT_IN_PROGRESS`, `errors.UNKNOWN`, `errors.UNKNOWN_PROVIDER`, `errors.VALIDATION_ERROR`, `form.english`, `form.spanish`.
- Settings scope: `confirm`, `create`, `error`, `save`, `saving`, `steps`.

The unused report `errors.*` values are superseded by keys composed dynamically in `ReportsPage.handleError`; these entries are **not** actually dead. The extractable referenced success paths in these dynamic keys exist in both locales.

### Hard-coded visible template text

- `English` and `Español` appear directly in the language selectors in profile, report form, and language-switcher templates. These are language names, but are still hard-coded visible strings.
- `Taskory` is the hard-coded product brand in `app.html`.
- No other literal user-facing prose was found in application templates. Text rendered from API data (provider IDs, counts, activity names) is dynamic, not untranslated UI copy.

## Findings by severity

| Severity | Finding | Evidence / impact |
|---|---|---|
| P1 | OAuth consent decision sends the wrong field | `OAuthRequestsRepository.decide()` sends `{approved}`; API DTO requires `approve`. Reproduction: live POST with repository body → 400 `VALIDATION_ERROR`. Both Allow and Deny fail in the web consent page. |
| P2 | Connected-app response model does not match API | `ConnectedApp.clientId` is required but absent; `lastUsedAt` is returned but missing from the model. Consumers cannot rely on the model for the actual list response. |
| P2 | ConsentRequest model omits API field | API returns `accessDescription: "full-access"`; model omits it, despite the consent-hardening spec requiring the page to describe full access. |
| P2 | Report job type is invalid across status transitions | `ReportJob` requires `markdown/provider/model/activityCount` even while queued/running and omits the failed error message. Retry endpoint's 202 response also only contains `{id,status,progress}` but is typed as full `ReportJob`. |
| P2 | Redirect validation in the consent page is weaker than the API's registered-URI check | `safeRedirect` permits same-scheme redirects to another host. API currently returns a redirect based on persisted request data, limiting reachability, but the client check does not enforce the stated destination invariant. |
| P3 | API activity JSON includes undocumented `userId` | Live create/get/update/list items expose the ownership ID, absent from API contract/spec and web model. It is currently tolerated as an extra property but violates the published response shape. |

## Commands and live evidence

- `cd apps/api && npm run build` — passed.
- `cd apps/web && npm run build` — passed.
- `cd apps/web && npm test` — passed: 56 test files, 184 tests.
- Live requests covered auth register/login/me/update, all activity methods including all filters and meta, API key create/list/revoke, providers, 5-activity sync report, 101-activity chunked report through completion, non-failed retry, concurrent report conflict, OAuth client registration/authorize/consent lookup/approve/deny, and connected-app list/delete.
- API and fake Ollama processes were stopped by ports 3984 and 3983 after the checks.
