# Cross-review: API foundation auth

Review scope: `GET /health`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`, and `GET/POST/DELETE /api-keys` under `/api/v1`.

## Endpoint review

| Endpoint | (a) Implementation vs spec/contract | (b) Bruno request fidelity and scenario coverage | (c) Unit/e2e scenario test | Result |
|---|---|---|---|---|
| `GET /health` | Controller delegates to health service; public route returns 200 `{status:"ok"}`. No user data or secrets. | `health/health.bru`: GET `/health`, no auth/body, JSON accept header, checks 200 and exact body; docs names Service up. | E2E `Health check / Service up`. | OK |
| `POST /auth/register` | DTO validates email, nonempty name and password length >=8; service lowercases email, bcrypt-hashes password, handles duplicate races; returns 201 token/public user; localized stable errors. | `auth/register.bru`, duplicate and weak-password requests match method/URL/body/auth and assertions; docs identify scenarios. Success checks only profile keys, which rules out password/hash. | E2E `Successful registration`, `Duplicate email`, `Weak password`, `Profile never exposes secrets`, `Database leak`, plus error-format/localization scenarios. Auth unit tests cover hashing, duplicate handling and safe profile. | OK |
| `POST /auth/login` | DTO validates email/string password; service compares bcrypt hash and returns token/public profile; unknown email and wrong password both map to 401 `INVALID_CREDENTIALS` with same localized message. | `auth/login.bru` and English/Spanish invalid credential requests use correct POST URL and body; checks status/code and safe profile keys. English and Spanish headers present; Spanish test checks nonempty message, not language content. Docs identify scenarios. | E2E `Valid credentials`, `Invalid credentials`, `Profile never exposes secrets`; unit test explicitly compares equal error outcomes. | OK |
| `GET /auth/me` | Guard accepts JWT or API key and resolves current user; deleted-user JWT and revoked/unknown keys become 401 `UNAUTHORIZED`. Public-user projection omits password/hash. | `auth/me-get.bru` checks 200 and exact safe user keys. `auth/me-without-token.bru` checks unauthenticated 401. Docs identify scenarios. No standalone valid API-key-to-profile request. | E2E `Read profile`, `Missing or invalid token`, `Profile never exposes secrets`, and API-key authentication `Request with a valid key`; auth unit tests cover deleted JWT subject. | OK; Bruno scenario gap noted below |
| `PATCH /auth/me` | DTO permits optional nonempty name and only `es`/`en`; service updates by authenticated user ID and returns safe profile. Validation errors are normalized/localized. | `auth/me-patch.bru` checks updated profile, `me-patch-invalid-language.bru` checks Spanish validation error. Correct PATCH URL/body/bearer headers; docs identify update and unsupported-language scenarios. | E2E `Profile update`, `Unsupported language`; auth unit test checks update and safe projection. | OK |
| `GET /api-keys` | Guard required. Repository filters by requesting `userId` and active status; service returns only `id,name,prefix,createdAt,lastUsedAt`, excluding plaintext and hash. | `api-keys/list.bru` checks array and exact entry keys after creation; docs identify Key is never shown again. `list-without-token.bru` covers 401. | E2E `Key is never shown again`, `Database leak`; service unit test verifies list projection. | OK |
| `POST /api-keys` | Guard required. Service generates `tk_` random key, stores SHA-256 hash and prefix, returns plaintext once. DTO only requires a nonempty string name. | `api-keys/create.bru`: POST `/api-keys`, bearer auth, JSON body, checks 201, response keys and `tk_` prefix; docs identify Create key. | E2E `Create key`, `Database leak`; service unit tests verify hash-only persistence and one-time plaintext output. | OK |
| `DELETE /api-keys/:id` | Guard required; repository update scopes by both key ID and owner ID and only active keys. Missing/foreign/revoked IDs yield 404 `NOT_FOUND`; own key returns 204. | `api-keys/delete.bru` dynamically creates and deletes own key. `delete-foreign-key-404.bru` claims Another user's key but generates an ID that does not exist. Both have appropriate method/URL/auth/assertions, but the latter does not faithfully exercise ownership. `delete-revoked-key.bru` separately checks revoked-key auth. | E2E `Revoke own key`, `Another user's key`; service unit tests cover own-key revoke and not-found ownership result. | **Finding: Bruno foreign-owner case is not a foreign key** |

## Gaps and observations

- **Bruno coverage gap — API key authentication with a valid key:** spec scenario `API key authentication / Request with a valid key` has an e2e test, but no Bruno request uses a still-valid created key. The revoked-key request only exercises rejection.
- **Bruno coverage gap — unsupported `Accept-Language`:** the error spec scenario for an unsupported language header has e2e coverage but no Bruno request. The Spanish validation request tests a supported `es` header, not fallback from a header such as `fr`.
- **Bruno coverage gap — authentication rate limiting:** spec scenario `Authentication rate limiting / Too many attempts` has e2e coverage but no Bruno request. A single request cannot cover the scenario; a collection request/script could issue enough attempts.
- **Non-HTTP database leak scenarios:** password and API-key database hash scenarios are unit/e2e covered, not directly expressible as normal HTTP Bruno assertions. No explicit gap note exists in the collection docs.
- Live probe: 20,000-character `name` values were accepted by profile PATCH and API-key creation (200 and 201). Neither the reviewed spec nor `docs/api-contract.md` defines a max length for these names, so this is an uncapped-input observation, not a contract violation.
- Live SQL-like and Unicode user name input round-tripped unchanged (201); queries are parameterized/ORM-backed. No SQL injection observed.

## Findings

### Medium — Bruno foreign-key deletion request does not use another user's key

- **Reproduction:** run the collection request `api-keys/delete-foreign-key-404.bru`. Its pre-request script generates a fresh UUID that belongs to no row.
- **Actual:** the request receives the expected 404 `NOT_FOUND`, but only for a nonexistent key.
- **Expected:** create a key as one user and issue DELETE for that real key using a different user's token, then assert 404 `NOT_FOUND`.
- **Evidence:** direct live probe with two registered users and a real key owned by user A, deleted with user B's token, returned 404 `NOT_FOUND`; e2e `Another user's key` also covers the correct case. The implementation is correct; the Bruno assertion is not proof of the named ownership scenario.

## Execution evidence

- `cd apps/api && npm run build` — passed.
- Started `JWT_SECRET=x DATABASE_PATH=/tmp/p01-xreview.sqlite PORT=3998 node dist/main.js` — started successfully and stopped after probing. Did not use ports 3000 or 3999.
- `cd bruno/taskory && bru run --env local --env-var baseUrl=http://localhost:3998/api/v1 --tests-only` — 17/17 requests passed.
- Edge probes: unknown `Accept-Language: fr` returned English; malformed JSON returned 400 `{statusCode,code,message}` with `VALIDATION_ERROR`; real foreign-key delete returned 404 `NOT_FOUND`; deleted-user JWT and revoked API key returned 401 `UNAUTHORIZED`; SQL-like/Unicode name was stored and returned without issue.
