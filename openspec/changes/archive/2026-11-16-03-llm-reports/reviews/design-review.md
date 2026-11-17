## Design review: 03-llm-reports (working tree relative to HEAD)

Intent: Generate scoped activity reports through interchangeable LLM providers, with controlled errors and bounded input.

### Findings (most severe first)

- [must-fix][architecture] `apps/api/src/reports/report-generator.provider.ts:13`, `packages/llm/src/registry/provider-registry.ts:5`, `packages/llm/src/report/report-generator.ts:19` — The API supplies its own provider map, bypassing the library registry. Adding an adapter and its registry entry makes it available to a default `ReportGenerator`, but not to either API endpoint; the API composition must also change. This violates the provider abstraction's one-registration requirement and creates two sources of truth. Construct the API generator from the shared registry, keeping provider configuration in the factories or a single composition point.
- [should-fix][bad practices] `apps/api/src/activities/activities.service.ts:74`, `apps/api/src/activities/activities.repository.ts:78` — Report tags are passed directly to an exact JSON comparison, although creation and ordinary list filtering normalize tags to lowercase and trim whitespace (`activities.service.ts:23`, `:64`, `:78`). For example, an activity saved with `API` is stored as `api`, but a report filter of `API` matches nothing. Normalize report tags through the same service rule and test mixed case and whitespace against the real query.
- [should-fix][bad practices] `packages/llm/src/types/llm-provider.ts:1`, `packages/llm/src/providers/http-json.ts:32`, `packages/llm/src/providers/ollama.provider.ts:26`, `packages/llm/src/providers/deepseek.provider.ts:28` — The design calls for a timeout configurable per call, but the timeout is fixed when each provider is constructed and `CompleteInput` has no timeout. The API also provides no documented way to set `LLM_TIMEOUT_MS` in `apps/api/.env.example`. Add a per-call timeout through the existing completion contract and document any supported environment fallback, or reconcile the design if instance-level configuration is intended.
- [should-fix][bad practices] `packages/llm/src/report/report-generator.ts:45`, `packages/llm/test/report-generator.test.ts:63` — When a request selects a non-default provider and omits `model`, the generator ignores `DEFAULT_LLM_MODEL`. The Defaults requirement (`openspec/changes/03-llm-reports/specs/llm-providers/spec.md:21`) says to use that configured model when omitted; the test instead codifies a provider-specific fallback. Reconcile the contract with the intended provider compatibility behavior and align implementation and tests; applying a model intended for a different provider can itself fail.
- [should-fix][tests] `packages/llm/test/llm-providers.test.ts:7`, `apps/api/test/reports.e2e-spec.ts:27` — The provider test only checks that an `AbortSignal` exists, and the e2e test replaces the whole generator. Neither verifies an actual abort is translated to `LLM_UNAVAILABLE` through the real provider/generator boundary, nor that API wiring uses the library registration. Add a controlled abort-aware fetch test and a composition test retaining the real generator while replacing only transport. This also gives the timeout and registration contracts regression protection.
- [nit][formatting] `packages/llm/src/report/report-options.ts:2`, `packages/llm/src/registry/provider-registry.ts:5` — Multiple declarations and the whole registry are compressed onto single lines, contrary to `docs/agent-rules.md`'s readable one-statement-per-line rule. Expand them into readable lines. No formatter configuration was found for these packages, so no formatter check was available.

### Done well

- `apps/api/src/activities/activities.repository.ts:70` performs a single bounded query with the authenticated user predicate, and `apps/api/test/reports.e2e-spec.ts:53` exercises isolation against a real database. Reports access the query through `ActivitiesService`.
- `packages/llm/src/report/report-prompt.ts:11` escapes the data delimiter and explicitly identifies activity JSON as untrusted data. Provider errors are mapped to a localized generic API response (`apps/api/src/reports/reports.service.ts:70`); the reviewed response path does not return the underlying error or credentials. Delimiting mitigates prompt injection but cannot guarantee model compliance.

### Scores (orientative)

| Category | Weight | Score | Why |
|---|---:|---:|---|
| Architecture | 20% | 7/10 | One must-fix: split provider registration. |
| Bad practices | 15% | 5.5/10 | Three contained contract and normalization issues. |
| Antipatterns | 15% | 10/10 | No additional findings. |
| Design patterns | 15% | 10/10 | No additional findings. |
| Naming | 15% | 10/10 | No findings. |
| Tests | 15% | 8.5/10 | Timeout and real composition paths lack regression coverage. |
| Formatting | 5% | 9.5/10 | Readability rule violated in compressed declarations. |

Global: 8.5/10 — Verdict: approve with changes (architecture must-fix).

Scope and limits: Reviewed the specified change and its planning/contract context; unrelated working-tree changes and generated files were excluded. The repository was not present in the codebase-memory index, so caller and impact analysis used source and text search. Tests and live providers were not run in this read-only review; no Git writes or source edits were made.
