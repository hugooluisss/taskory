## Design review: 02-activities, round 2
Intent: Provide authenticated, isolated activity CRUD, filtered listing and metadata, including validated inputs and repeatable coverage.

### Findings (most severe first)
- [should-fix][bad practices] `apps/api/src/activities/activities.service.ts:72`, `apps/api/src/activities/dto/activity-field-validators.ts:13` — The new filter-date check duplicates the complete calendar-date algorithm used by create and update. A future date-rule change must be applied in both places to keep accepted dates consistent. Extract a shared, framework-independent date predicate and use it from the service and DTO validator.
- [should-fix][tests] `apps/api/src/activities/activities.service.spec.ts:4`, `apps/api/src/activities/activities.repository.spec.ts:25`, `apps/api/test/activities.e2e-spec.ts:177` — Scenario traceability remains incomplete: the service and repository tests still combine scenarios under broad names, and the e2e `Foreign activity` test is under `Activity read, update and delete` rather than the spec's `Per-user isolation`. `docs/agent-rules.md` requires requirement and scenario names. Group and name these tests after their spec requirements and scenarios, with separate tests for distinct scenarios.
- [should-fix][tests] `bruno/taskory/activities/list-percent-literal.bru:7`, `bruno/taskory/activities/list-percent-literal.bru:15`, `bruno/taskory/activities/list-percent-literal.bru:21` — The new literal-percent case searches all existing percent-containing activities and only checks inclusion in the first page. Existing data can push the new record off that page, and a wildcard implementation also passes because no nonmatching record is excluded. Isolate the query using a unique project or fresh user, create a negative control, and assert the exact IDs.
- [should-fix][tests] `bruno/taskory/activities/list-same-date-order.bru:21`, `bruno/taskory/activities/list-same-date-order.bru:22` — The new equal-date test uses a fixed 1.1-second sleep to create distinct timestamps, contrary to the review's no-sleeps test criterion. Its result depends on the server clock advancing normally, and it delays every run. Use deterministic timestamp setup where available, or keep the deterministic database-backed ordering test in `apps/api/src/activities/activities.repository.spec.ts:45` as the ordering regression and make the Bruno case independent of a sleep.
- [should-fix][tests] `apps/api/test/activities.e2e-spec.ts:49`, `apps/api/test/activities.e2e-spec.ts:167`, `bruno/taskory/activities/patch-protected-fields.bru:32` — The protected-fields scenario does not fully establish its stated POST/PATCH guarantee: the POST test does not compare the submitted ID or updated timestamp, and the PATCH e2e does not assert the owner or re-read stored values. The Bruno PATCH case checks response fields only. Assert all four protected fields against the submitted and original values, then read the stored record, for both methods.
- [should-fix][formatting] `apps/api/src/activities/activities.repository.ts:83`, `apps/api/src/activities/dto/list-activities.dto.ts:5`, `apps/api/test/activities.e2e-spec.ts:211` — Compressed control flow and multiple decorators/declarations on one line remain, including a loop and its assertion on one line, against the readable one-statement-per-line rule in `docs/agent-rules.md`. Expand these consistently. No formatter configuration or script was found for this app.

### Previous findings: status
| Previous finding | Status | Current evidence |
|---|---|---|
| Design: tag normalization in repository | Fixed | `apps/api/src/activities/activities.service.ts:58` normalizes the tag before passing it to `apps/api/src/activities/activities.repository.ts:86`. |
| Design: duplicate create/update validation | Fixed | Both DTOs use the shared constraints in `apps/api/src/activities/dto/activity-field-validators.ts:33`; see `apps/api/src/activities/dto/create-activity.dto.ts:12` and `apps/api/src/activities/dto/update-activity.dto.ts:14`. The separate new filter-date duplication is reported above. |
| Design: weak date-range and timestamp assertions | Fixed | `apps/api/test/activities.e2e-spec.ts:96` creates records on both sides of the range and asserts the exact results; `apps/api/test/activities.e2e-spec.ts:191` asserts the controlled update timestamp differs from the original. |
| Design: tests named after scenarios | Not fixed | E2e scenario names improved, but combined service/repository cases and the misplaced foreign-activity scenario remain at `apps/api/src/activities/activities.service.spec.ts:4`, `apps/api/src/activities/activities.repository.spec.ts:25`, and `apps/api/test/activities.e2e-spec.ts:206`. |
| Design: Bruno depends on prior requests/data | Not fixed | Earlier list and CRUD requests now create their own fixtures, e.g. `bruno/taskory/activities/list-date-range.bru:20` and `bruno/taskory/activities/get.bru:20`; the new percent case remains sensitive to existing matching data and pagination at `bruno/taskory/activities/list-percent-literal.bru:7`. |
| Design: compressed formatting | Not fixed | `apps/api/src/activities/activities.repository.ts:83`, `apps/api/src/activities/dto/list-activities.dto.ts:5`, and `apps/api/test/activities.e2e-spec.ts:211` still use compressed lines. |
| Cross-review: oversized body returns 500 | Fixed | `apps/api/src/common/errors/errors.filter.ts:26` maps 413 to `PAYLOAD_TOO_LARGE`; `apps/api/test/activities.e2e-spec.ts:162` checks a 2 MiB request and localized response. |
| Cross-review: edge behavior lacks named tests and faithful Bruno requests | Not fixed | Coverage improved for reversed dates, empty PATCH, invalid IDs and selected limits (`apps/api/test/activities.e2e-spec.ts:141`, `bruno/taskory/activities/create-21-tags.bru:27`, `bruno/taskory/activities/get-invalid-id.bru:14`), but protected-field assertions remain incomplete and the literal-percent request lacks a negative control (`apps/api/test/activities.e2e-spec.ts:49`, `bruno/taskory/activities/list-percent-literal.bru:21`). |
| Cross-review: localized messages and metadata isolation in Bruno | Fixed | Spanish and English are asserted at `bruno/taskory/activities/create-missing-title-400.bru:31` and `bruno/taskory/activities/list-page-invalid.bru:21`; `bruno/taskory/activities/meta-isolation.bru:27` checks both users, including exact foreign metadata. |

### Done well
- The controller delegates data operations to the service, repository methods take `userId`, and tag-filter normalization now lives in the service.
- Date-range fixtures include both boundaries and out-of-range records; the oversized-body scenario has an end-to-end regression test.

### Scores (orientative)
| Category | Weight | Score | Why |
|---|---:|---:|---|
| Architecture | 20% | 10/10 | No finding. |
| Bad practices | 15% | 8.5/10 | Calendar validation is duplicated across the service and DTO validator. |
| Antipatterns | 15% | 10/10 | No finding. |
| Design patterns | 15% | 10/10 | No finding. |
| Naming | 15% | 10/10 | No finding. |
| Tests | 15% | 5/10 | Four contained findings; the combined deduction is capped at five points. |
| Formatting | 5% | 8.5/10 | Compressed statements remain. |

Global: 9.0/10 — Verdict: approve

Validation: `npm test -- --silent` passed (11 suites, 39 tests); `npm run test:e2e -- --silent` passed (2 suites, 50 tests). The Bruno collection was inspected but not executed. Codebase-memory has no index for this repository, so impact analysis used direct source reads and searches. Review excludes phase 03 and generated files.
