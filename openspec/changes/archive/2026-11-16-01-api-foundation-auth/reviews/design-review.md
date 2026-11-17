## Design review: 01-api-foundation-auth, round 2

Intent: establish the API foundation with user authentication, personal API keys, localized errors, and a Bruno collection.

### Findings

- **[should-fix][architecture] Repository exposes an unbounded key creation path** — `apps/api/src/api-keys/api-keys.repository.ts:13-15` still exposes `create`, which bypasses the limit enforced by `createIfBelowLimit` at `:29-37`. Source search found no production caller of the unbounded method; repository tests use it for fixture setup (`apps/api/src/api-keys/api-keys.repository.spec.ts:38-40`). The current controller path goes through the bounded method (`apps/api/src/api-keys/api-keys.service.ts:23-30`), but the extra public method makes it easy for a future service caller to bypass the invariant. Remove the unused public methods `create` and `countActive` (`:25-27`) and use the TypeORM test repository for fixture setup; retain the atomic bounded operation as the production creation path.
- **[should-fix][tests] Concurrent key creation is not tested at the limit** — `apps/api/src/api-keys/api-keys.repository.ts:29-37` adds a transactional count-then-insert to enforce the per-user bound, but the e2e limit tests create keys sequentially (`apps/api/test/auth.e2e-spec.ts:318-338`), and the isolated repository test checks `countActive` rather than `createIfBelowLimit` (`apps/api/src/api-keys/api-keys.repository.spec.ts:54-60`). The service test mocks the bounded operation (`apps/api/src/api-keys/api-keys.service.spec.ts:36-42`). These checks do not establish behavior when requests compete for the final slot. Add a temporary-database test with concurrent attempts and assert the stored active count and outcomes; handle contention as needed. This is a verification gap, not a claim that the limit has been exceeded.
- **[should-fix][formatting] Dense statements obscure error mapping and request validation** — `apps/api/src/common/errors/errors.filter.ts:15` puts five error-code branches in one nested conditional; `apps/api/src/health/health.controller.ts:7` combines decorator, method, and return on one line; and `apps/api/src/auth/dto/update-profile.dto.ts:4-5` chains decorators and declarations. Similar DTO declarations appear in `apps/api/src/auth/dto/register.dto.ts:5-6` and `apps/api/src/api-keys/dto/create-api-key.dto.ts:4`. This conflicts with the explicit readability rule in `docs/agent-rules.md:20`. Expand the conditional and declarations into readable lines. No configured formatter was found, so no formatter check was available.

### Previous findings: status

| Previous finding | Status and evidence |
|---|---|
| SQLite error details escape the repository | **Fixed:** translation is in `apps/api/src/users/users.repository.ts:26-32`; `apps/api/src/auth/auth.service.ts:18-24` handles `DuplicateEmailError`. |
| API key list is called bounded but has no bound | **Addressed for the current production path:** `apps/api/src/api-keys/api-keys.service.ts:17-32` invokes the transactional limit check in `apps/api/src/api-keys/api-keys.repository.ts:29-37`. Sequential limit and slot-release scenarios are at `apps/api/test/auth.e2e-spec.ts:318-338`. The unbounded repository method and concurrency verification remain findings above. |
| Authentication hides infrastructure failures as invalid credentials | **Fixed:** token errors are caught narrowly in `apps/api/src/auth/auth.service.ts:36-49`; the redundant catch is gone in `apps/api/src/auth/token-auth.service.ts:10-14`. A storage-failure test is at `apps/api/src/auth/auth.service.spec.ts:154`. |
| List contract contradicts the revised spec | **Fixed:** `docs/api-contract.md:18-19` agrees with `openspec/changes/01-api-foundation-auth/specs/api-errors-i18n/spec.md:21-22` and the API-key limit specification. |
| UsersService is a pass-through abstraction | **Fixed:** `apps/api/src/users/users.service.ts:14-23` now owns email normalization and duplicate detection; its behavior is tested at `apps/api/src/users/users.service.spec.ts:5-20`. |
| Repository behavior has no isolated database tests | **Fixed for the original gap:** temporary SQLite tests now cover users (`apps/api/src/users/users.repository.spec.ts:15-23`, `:36-43`) and key lookup and ownership (`apps/api/src/api-keys/api-keys.repository.spec.ts:17-30`, `:38-51`). The new concurrent-limit gap is separate above. |
| E2E setup reconstructs the application instead of exercising it | **Fixed:** `apps/api/test/auth.e2e-spec.ts:449-455` imports `AppModule` and calls `configureHttp`, as production does at `apps/api/src/main.ts:7-10`. |
| Some spec scenarios are not traceable by their required names | **Fixed for the reported scenarios:** `apps/api/src/common/pagination/pagination.spec.ts:3-6` uses the requirement and scenario names, and `apps/api/src/auth/auth.service.spec.ts:19`, `:34`, `:46` uses the corresponding registration names. Extra unit cases retain descriptive names. |

The cross-review's foreign-owner Bruno case now creates a real key and a second user (`bruno/taskory/api-keys/delete-foreign-key-404.bru:18-35`); valid API-key authentication and unsupported-language fallback have requests at `bruno/taskory/api-keys/authenticate.bru:6-23` and `bruno/taskory/auth/login-invalid-credentials.bru:11-31`. These were inspected, not executed.

### Done well

- Controllers delegate to services, and database access in application code is confined to repositories and ORM configuration.
- The real application module and HTTP setup are now shared with e2e tests, and repository tests use temporary SQLite databases.

### Scores (orientative)

| Category | Weight | Score | Why |
|---|---:|---:|---|
| Architecture | 20% | 8.5/10 | Unbounded repository creation method remains exposed. |
| Bad practices | 15% | 10/10 | No finding. |
| Antipatterns | 15% | 10/10 | No finding. |
| Design patterns | 15% | 10/10 | No finding. |
| Naming | 15% | 10/10 | No finding. |
| Tests | 15% | 8.5/10 | Concurrent enforcement of the new limit is unverified. |
| Formatting | 5% | 8.5/10 | Dense statements conflict with the project's readability rule. |

**Global: 9.4/10 — Verdict: approve.**

Scope: the requested modified and untracked files relative to HEAD, excluding generated files. The codebase-memory index does not contain this repository, so structural impact analysis used source reading and search. No tests were run in this read-only review; no configured formatter was found. Commit hygiene is not applicable to the uncommitted change.
