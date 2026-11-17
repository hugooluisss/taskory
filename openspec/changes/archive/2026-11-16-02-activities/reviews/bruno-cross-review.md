# 02-activities API cross review

**Scope:** read-only review of `apps/api/src/activities`, the change spec, `docs/api-contract.md`, activity Bruno requests, and activity unit/e2e tests.

**Execution:** `npm run build` passed. Started `node dist/main.js` with `JWT_SECRET=x`, `DATABASE_PATH=/tmp/p02-xreview.sqlite`, `PORT=3998`; Bruno `bru run --env local --env-var baseUrl=http://localhost:3998/api/v1 --tests-only` passed (40/40 requests/tests across collection). Server was stopped afterwards. The requested curl-equivalent edge probes were run with authenticated HTTP requests against that server. No source edits were made.

## Endpoint review

| Endpoint / scenario | Implementation vs spec and contract | Bruno coverage | Unit/e2e coverage | Result |
|---|---|---|---|---|
| `GET /activities` default list and ordering | User-scoped query; `date DESC`, then `createdAt DESC`; envelope `{items,total,page,limit}`; defaults page 1/limit 50. | `list.bru` checks envelope/defaults/date order, but uses three different dates, so does not prove same-date `createdAt` ordering. | E2E `Equal dates sort by createdAt descending and LIKE wildcards match literally`; repository test `Equal dates sort by createdAt descending`. | Pass; Bruno ordering assertion is partial. |
| `GET /activities?from&to` | `>= from` and `<= to`, inclusive. Date filter values are only validated as strings, not calendar dates. `from > to` is accepted and returns an empty list. | `list-date-range.bru` checks inclusive example. | E2E `Date range, project, tag, text search, and pagination`; repository test `Date range, exact tag and escaped text search are user scoped`. | Inclusive behavior passes; invalid/reversed filter input is not covered. |
| `GET /activities?project` | Exact project equality and user-scoped. | `list-project.bru`. | E2E `Date range, project, tag, text search, and pagination`. | Pass. |
| `GET /activities?tag` | Trims/lowercases query tag and checks exact JSON-array element equality. | `list-tag.bru`. | E2E checks `tag=api`, `tag=api-v2`; repository test covers exact `api` vs `api-client`. | Pass. |
| `GET /activities?q` | Matches title or description, case-insensitively; escapes `\\`, `%`, and `_` so LIKE metacharacters are literal. Query length capped at 200. Unicode and quotes are accepted; 201-character query returns 400. | `list-query.bru` proves a simple title match only; no wildcard/description/Unicode/quote request. | E2E `Date range, project, tag, text search, and pagination` and `Equal dates sort by createdAt descending and LIKE wildcards match literally`; repository test `Date range, exact tag and escaped text search are user scoped`. | Pass; Bruno scenario is weaker than requested edge coverage. |
| `GET /activities?page&limit` | Non-integers fail validation (400); non-positive integers normalize to page 1 / limit 50; positive limit caps at 200. | `list-limit-max.bru`; no invalid/zero/negative pagination request. | E2E `Limit above cap`; `Rejects non-numeric pagination and defaults negative pagination`; pagination unit tests. | Pass. |
| `POST /activities` minimal | Defaults `referenceUrls` and `tags` to `[]`, `description` and `project` to `null`. | `create-minimal.bru`. | E2E `Minimal activity and multiple reference URLs`. | Pass. |
| `POST /activities` references | Validates max 20 HTTP(S) URLs and preserves submitted order. | `create-references-tags.bru` checks two URLs/order; `create-invalid-url-400.bru` checks one bad URL. | E2E `Minimal activity and multiple reference URLs`; `Missing or malformed required fields and invalid URL`. | Pass. Limits/protocol edge cases only proved by requested live probes, not named tests. |
| `POST /activities` date/title/description | Calendar date, title length 1–200, description max 10,000. `2026-02-30`, `0000-00-00`, title length 201, and description length 10,001 all returned 400 `VALIDATION_ERROR`. | Missing title and malformed date requests; no description/title-boundary request. | E2E `Missing or malformed required fields and invalid URL` covers absent fields, malformed date, empty title; no length-specific named case. | Pass for probed bounds; validation test coverage gap. |
| `POST /activities` tags | At most 20 tags, each string up to 50 chars; normalized by trim/lowercase/dedupe, dropping empty values. 21 tags and 51-char tag returned 400. | `create-normalized-tags.bru`; no max-boundary request. | E2E `Duplicate tags are normalized`; service test `Normalizes tags, defaults optional fields, and preserves partial updates`. | Pass; max constraints lack named tests. |
| `GET /activities/:id` | UUID pipe rejects malformed IDs with 400; owner gets record; non-owner/missing gets 404 `NOT_FOUND`, not 403. | `get.bru`, `get-deleted-404.bru`, `get-foreign-activity-404.bru`; no non-UUID request. | E2E `Owner reads and deletes; foreign read, patch and delete return not found`. | Pass. |
| `PATCH /activities/:id` | Partial updates preserve other fields and update `updatedAt`; DTO whitelist strips `id`, `userId`, and `createdAt`; foreign IDs return 404; empty `{}` currently succeeds with 200 and advances `updatedAt`. | `patch-title.bru` checks fields and timestamp (though timestamp variable setup is brittle); `patch-foreign-activity-404.bru`; no empty-body or mass-assignment request. | E2E `Partial update preserves fields and changes updatedAt`; foreign behavior above. No empty/mass-assignment named test. | Behavior safe for mass assignment; empty patch is unspecified by spec. Coverage gap. |
| `DELETE /activities/:id` | Owner delete returns 204; foreign or missing owner-scoped record returns 404 `NOT_FOUND`; malformed id returns 400. | `delete.bru`, `get-deleted-404.bru`, `delete-foreign-activity-404.bru`; no non-UUID request. | E2E `Owner reads and deletes; foreign read, patch and delete return not found`. | Pass. |
| `GET /activities/meta` | Projects and tags are distinct, ordered, and scoped to current user. Route declared before `:id`. | `meta.bru` checks known values are included, not exact sets or foreign-user absence; `list-foreign-user-activities.bru` checks listing only. | Repository test `Metadata returns distinct values for one user`; E2E `Listing and suggestions never leak another user's data` asserts exact metadata for each user. | Pass; Bruno does not independently establish no metadata leakage. |

## Validation, localization, and probe results

- Error response shape is `{statusCode, code, message}`. `ErrorsFilter` localizes known messages for `Accept-Language: es` and `en` (defaults/fallback to English); Bruno's invalid create requests include Spanish headers for two cases but only assert the stable code, not localized message text. This activity suite does not prove both message strings over HTTP.
- Invalid date values `2026-02-30` and `0000-00-00`: 400 `VALIDATION_ERROR`.
- Title 201 chars; description 10,001 chars; 21 reference URLs; `javascript:` and `data:` URLs; 21 tags; 51-char tag: each 400 `VALIDATION_ERROR`.
- Non-UUID activity id: 400 `VALIDATION_ERROR`.
- Foreign GET/PATCH/DELETE: each 404 `NOT_FOUND`; no 403. Separate user's listing/meta were empty despite owner data.
- Empty PATCH body: 200, unchanged business fields, `updatedAt` changed. No explicit spec rule requires rejection.
- PATCH with `userId`, `id`, `createdAt`: 200, fields were stripped and persisted identity/owner/creation time remained unchanged.
- `page=0`, `limit=0`, `limit=-5`: 200 and normalized to page 1 / limit 50. `page=abc`: 400 `VALIDATION_ERROR`.
- `q=%`, `q=_`, and quoted `q` accepted; tested matches were literal substrings (no wildcard expansion). Unicode `café` matched. Query length 201 and a 10,000-character query returned 400 due the documented DTO cap.
- `from=2026-03-01&to=2026-02-01`: 200 empty list; order-of-range is not rejected.
- 2 MiB JSON request (description exceeded both 10,000-char DTO limit and Express body parser default): returned 500 `INTERNAL_ERROR`, rather than a client error. See finding below.

## Findings

### Medium — Oversized JSON body becomes 500

**Reproduction:** authenticated `POST /activities` with a JSON body containing a 2 MiB description. On the requested server configuration, response was `500 {"statusCode":500,"code":"INTERNAL_ERROR","message":"Internal server error"}`.

**Expected:** reject oversized client input with a 4xx validation/payload-size response. The body is far beyond the API's 10,000-character description limit; returning 500 misclassifies client input and may obscure the actual cause. Add a regression test for parser-limit errors and map the exception to 413 (or another established 4xx contract).

### Low — Activity edge behavior lacks named scenario tests and faithful Bruno requests

The live probes establish tag/URL/count/length limits, invalid/non-UUID IDs, page 0/limit 0, empty PATCH, mass-assignment stripping, wildcard/Unicode/long query behavior, and reversed date range. These do not have matching scenario-named tests and/or Bruno requests. Existing tests combine multiple behaviors under broad names, and Bruno covers only the basic cases. Add focused requests/tests for externally meaningful limits and security edges if these are required regression guarantees.

### Low — Bruno does not fully verify localized messages or metadata isolation

Spanish validation requests assert status and code only, not the Spanish message; no activity request checks an English message. `meta.bru` checks inclusion rather than exact per-user values, and no second-user metadata request exists. E2E/repository tests do assert exact metadata isolation, so implementation coverage exists, but Bruno coverage is weaker than requested.

## Coverage gaps by spec scenario

| Spec scenario | Bruno request | Named unit/e2e test |
|---|---|---|
| Minimal activity | `create-minimal.bru` | E2E `Minimal activity and multiple reference URLs` |
| Multiple reference URLs | `create-references-tags.bru` | E2E same as above |
| Missing required field | `create-missing-title-400.bru`, `create-malformed-date-400.bru` (title absent and malformed date; date absent only in e2e) | E2E `Missing or malformed required fields and invalid URL` |
| Invalid URL | `create-invalid-url-400.bru` | E2E same as above |
| Duplicate tags | `create-normalized-tags.bru` | E2E `Duplicate tags are normalized`; service test `Normalizes tags, defaults optional fields, and preserves partial updates` |
| Date range | `list-date-range.bru` | E2E `Date range, project, tag, text search, and pagination`; repository `Date range, exact tag and escaped text search are user scoped` |
| Text search | `list-query.bru` | E2E combined filter case and `Equal dates sort by createdAt descending and LIKE wildcards match literally`; repository combined filter case |
| Partial update | `patch-title.bru` | E2E `Partial update preserves fields and changes updatedAt`; service `Partially updates and deletes an owned activity` |
| Delete | `delete.bru`, `get-deleted-404.bru` | E2E `Owner reads and deletes; foreign read, patch and delete return not found` |
| Foreign activity | `get-foreign-activity-404.bru`, `patch-foreign-activity-404.bru`, `delete-foreign-activity-404.bru` | Same E2E foreign/owner test; service normalization test also asserts not found update/delete/read |
| Listing never leaks | `list-foreign-user-activities.bru` | E2E `Listing and suggestions never leak another user's data` |
| Suggestions | `meta.bru` (inclusion only) | Repository `Metadata returns distinct values for one user`; E2E isolation test |

Spec coverage omissions in Bruno: named/default ordering scenario with equal dates; date validation for list filters and reversed range behavior; explicit exact-tag negative; description-only query; invalid pagination values; create bounds (title/description/URL count/tag count/tag length); malformed IDs for all ID routes; empty PATCH/mass assignment; exact metadata isolation; English/Spanish message assertions. The contract/spec also do not define what empty PATCH or reversed date filters should do, so those probe outcomes are documented rather than treated as implementation failures.
