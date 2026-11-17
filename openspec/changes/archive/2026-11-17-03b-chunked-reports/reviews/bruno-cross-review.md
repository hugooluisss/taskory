# Cross review: 03b-chunked-reports

**Scope:** the two modified report specs, `design.md`, `tasks.md`, report endpoints, `evaluateChunk` / `writeFinal` / memory consolidation, the chunked Bruno folders, and named tests.

**Verdict:** runtime implementation behavior checked here is conformant for the exercised paths. One Bruno request is mislabeled and does not exercise its documented 250-activity scenario. Several other scenarios have no Bruno request, and there are smaller named-test gaps. No functional implementation defect was reproduced.

## Runtime evidence

- `cd apps/api && npm run build` passed.
- Started the fake Ollama on **3995** and the API on **3994** using `/tmp/p3b-xr.sqlite`; no disallowed ports were used and `tools/run-chunked-bruno.sh` was not run.
- Ran `bru run reports/chunked/normal ... --tests-only -r`: **14/14 requests passed**.
- Ran `bru run reports/chunked/slow ... --tests-only -r`: **2/2 passed**, including English and Spanish `REPORT_IN_PROGRESS` with the active job id.
- Ran the transient Bruno folder: **1/1 passed**. Ran the failure/retry folder with its documented `FAKE_OLLAMA_FAIL_CHUNK=2 FAKE_OLLAMA_FAIL_TIMES=3` settings: **1/1 passed**. The failure folder fails against the default fake because it requires those flags; this was a setup mismatch, not an API failure.
- Live probes: exactly 100 returned `200` from the passing Bruno test; 250 returned `202`, `progress.total: 3`, then `completed`, `done: 3`, `activityCount: 250`; 3,000 returned `202` with 300 chunks when `REPORT_CHUNK_SIZE=10`, then completed with all 3,000 activities; 3,001 returned `422 RANGE_TOO_LARGE`.
- The 3,000-activity run used the fake's two highlights per 10-activity chunk (600 highlights), forcing the fixed `>100` consolidation path. The consolidation threshold has no environment override; only chunk size does.
- Live concurrency returned one `202` and one `409 REPORT_IN_PROGRESS`, with the conflict id equal to the accepted job id. Retrying a completed report twice returned `409 REPORT_NOT_RETRYABLE` both times.
- Deleting a running job returned `204`; polling it returned `404`; after waiting through the provider delay, the fake's evaluation-call count did not increase. A job queued behind two active jobs still completed after all 101 snapshot activities were deleted.
- A process-level restart against the same SQLite file marked an in-flight job `failed` with `error.code: INTERRUPTED`, retained progress (`9/11` chunks in that run), accepted retry with `202`, and subsequently completed at `11/11`.
- Zero activities returned `422`; malformed GET/retry/delete ids returned `400`; oversized language/model values returned `400`; a foreign user's GET returned `404` in the passing Bruno folder.
- Prompt containment was verified by named library tests and source inspection. The checked-in fake server does not log prompts, so prompt boundaries were not independently observed from its runtime logs.

## Scenario traceability

“Test” names below refer to the repository's named Jest/Vitest tests. Test presence was checked in source; the Jest/Vitest suites were not run for this review.

| Spec scenario | Implementation check | Bruno request / fidelity | Named test |
|---|---|---|---|
| Up to 100 activities | `POST /reports` uses `generate` at `<=100`; live exactly-100 response was 200 with count and no job id. | `normal/single-pass-100.bru` — exact 100; passed. It does not assert `provider` and `model`. | `Exactly 100 activities use one synchronous provider pass`; also `generates a synchronous report for exactly 100 activities` in Bruno. |
| 250 activities; 100/100/50 in date order | Snapshot orders by date then creation time; runner slices the persisted ordered ids by chunk size and restores id order after querying. Live 250 had total 3 and completed; the test asserts chunk lengths `[100,100,50]` and first ids. | `normal/async-202.bru` claims 250 in docs but creates **101** and expects two chunks. It does not cover the specified 250 scenario. | `250 activities` in `reports.e2e-spec.ts` and `report-job.runner.spec.ts`; runner test asserts `[100,100,50]`. |
| Chunk evaluation output validation | Structured JSON parser validates summary, allowed activity ids, impact enum and bounded text; retries up to two additional calls. | No standalone valid-output request. `transient/transient-retry-completes.bru` exercises a transient provider failure, not malformed/unknown output. | `validates structured output with known activity ids and short reasons`; `retries invalid JSON and succeeds on the next attempt`; `retries an unknown activity id and fails after two retries`; `rejects an invalid impact`; `rejects an empty summary`; `rejects more than 15 highlights after two retries`. |
| Invalid provider output fails after retries | Library returns typed invalid-output error after three attempts; runner stores failed status and chunk index. | No request for permanently invalid JSON or unknown ids. `with-failure/fail-and-retry.bru` instead tests provider HTTP failures. | `Maps invalid provider output to the exact failing chunk`; library tests `retries an unknown activity id and fails after two retries` and `rejects invalid JSON`-equivalent cases. |
| Memory accumulates and progress advances | Runner persists each chunk before updating `progressDone`. | `normal/completed-polling.bru` checks final done/total only; it does not inspect persisted memory mid-run. | `Memory accumulates`. |
| Restart preserves memory and marks running job interrupted | Startup recovers only `running` jobs as `failed/INTERRUPTED`; memory remains user/report scoped. Process restart reproduced the transition and subsequent retry. | No Bruno request. `tools/run-chunked-bruno.sh` does not run a restart scenario (and was not run). | `Startup recovery interrupts running jobs only`; `Memory survives a restart` (reboots the module over the same DB and checks retained memory/progress). |
| Completion status and completed response shape | GET maps completed status to markdown/provider/model/count and includes id/status/progress/timestamps. | `normal/completed-polling.bru` checks completed, markdown and progress; passed. | `Completed report status includes the result`; e2e `250 activities`. |
| More than 100 highlights consolidate before final writing | `writeFinal` calls `consolidateMemory` above 100 highlights or serialized-size budget. 3,000 live activities with chunk size 10 exercised this path. | No request deliberately produces >100 highlights; default fake-backed requests stay below the threshold. | `consolidates memory with more than 100 highlights`; also exact-100 and character-budget tests. |
| Running status shape and progress | GET emits common fields for all job states; live status was polled during work. | No request asserts a GET response while status is running. Async request only permits queued/running in its initial POST response. | **Gap:** no named test asserts the running GET shape (`id/status/progress/createdAt/finishedAt`) and `done` bounds. |
| Foreign job is hidden | All job/memory access is scoped by user; foreign GET maps to 404. | `normal/foreign-get-404.bru` — passed. | `Foreign job is not found`; `Foreign user cannot get, retry or delete a report`. |
| Failed status includes code and chunk | Runner maps typed errors and records the failing chunk index. | `with-failure/fail-and-retry.bru` checks `LLM_UNAVAILABLE`, chunk 1, and progress before retry; passed with required fake flags. | `Failure can be retried until completion`; `Maps invalid provider output to the exact failing chunk`; `Maps provider failure to LLM_UNAVAILABLE`. |
| Retry resumes from first incomplete chunk and reuses memory | Runner skips chunk indexes with saved memory; the named runner test seeds four of seven and evaluates the remaining three. Process restart probe retained completed chunks and recovered. | `with-failure/fail-and-retry.bru` resumes from chunk 2 of 2 only; it is not a 4-of-7 resume scenario. | `Resume` in `report-job.runner.spec.ts`; e2e `Resume` covers retry race but only a two-chunk job. |
| Retry queued/running/completed job gives `REPORT_NOT_RETRYABLE` | Service permits failed only; live completed retry returned 409. | `normal/nonretryable-409.bru` tests completed retry; passed. No separate queued/running Bruno request. | `Completed report cannot be retried`; `Retry of queued report is rejected`; `Only failed reports can be retried`. |
| One active job per user; conflict contains active id | Partial unique index plus service mapping; live same-user race returned one 202 and one 409 with matching active id. | `slow/active-job-conflict-409.bru` and `active-job-conflict-es-409.bru`; both passed. | `Second job of the same user`; `Second active report is rejected`; `Maps an active unique-index conflict to REPORT_IN_PROGRESS`. |
| At most two running globally; additional jobs wait | Runner uses global concurrency 2; third remains queued. | No Bruno request. | `Limits globally to two running jobs and leaves the third queued`. |
| Delete active job, stop provider calls, remove memory | Abort signal flows to provider; deletion cascades job/memory. Runtime delete/poll/provider-count probe passed. | `normal/delete-then-get-404.bru` deletes and verifies inaccessible, but without a slow provider it does not guarantee deletion occurred while active or verify no further call/memory removal. | `Delete` in e2e waits for an active evaluation, checks aborted signal, no final call, and no memory; repository test checks cascade. |
| Finished job retention after 30 days | Startup and daily purge use the 30-day cutoff and remove memory with the job. | No Bruno request. | `Retention purges expired jobs and memory`; `Purges only finished reports older than the retention cutoff`. |
| Range above 3000 rejected before provider call | Snapshot query caps at 3001; service rejects >3000 before provider. Live 3000/3001 boundary passed. | No Bruno request. | `Range too large` e2e inserts 3001 and asserts 422/no generator; service test `Range too large`. |
| Tag filter only includes matching activity | Report query uses tag membership filter. | No Bruno request. | `Tag filter`; `Mixed case and whitespace tag filter`. |
| No matching activities | Service returns `NO_ACTIVITIES` before provider. Live returned 422. | No Bruno request. | `No activities`; `No activities` in service tests. |
| es/en messages | English and Spanish message maps exist. Live/Bruno Spanish active conflict matched exact text. | Spanish `slow/active-job-conflict-es-409.bru` checks exact message; English counterpart checks code/id, not message. No Bruno coverage for localized `INVALID_LLM_OUTPUT` or `REPORT_NOT_RETRYABLE`. | `Retry errors are localized in Spanish` checks Spanish `REPORT_NOT_RETRYABLE`; no named test asserts Spanish `INVALID_LLM_OUTPUT` text. |
| Hostile activity/project text stays data in prompts | Evaluation, consolidation and final prompts JSON-escape user/model text in delimited data blocks and instruct the model to treat it as data. | No Bruno request; fake Ollama does not log prompt text. | `keeps hostile activity text inside escaped delimited JSON`; `keeps hostile project and highlight text inside escaped delimited JSON`. |
| Activities edited/deleted after snapshot do not crash queued job | Snapshot stores ids; missing rows become empty chunk memory. Live queued-job probe deleted all 101 activities before dispatch and still completed. | No Bruno request. | `Does not call the provider when every snapshot activity was deleted`; this is a runner unit test, not a queued HTTP job test. |
| Invalid report ids | UUID pipes reject malformed GET/retry/delete ids. Live all three returned 400. | `normal/invalid-id-400.bru` tests GET only; passed. | `Report ids must be UUIDs` tests all three. |

## Bruno requests missing or not faithful to a spec scenario

- `normal/async-202.bru`: documented as “250 activities” but creates 101; its `progress.total: 2` assertion confirms it is a two-chunk case, not 250 / three chunks.
- No `.bru` request covers >3000 rejection, tag filtering, no activities, retention expiry, a process restart/`INTERRUPTED`, global concurrency 2, running GET status shape, >100-highlight consolidation, standalone chunk-output validation, hostile prompt boundaries, or queued-snapshot deletion/editing.
- The failure/retry Bruno request verifies recovery from the second chunk of a two-chunk job; it does not cover the specified resume after 4 of 7 chunks.
- `normal/delete-then-get-404.bru` proves deletion and subsequent 404 but does not itself establish that the job was active at deletion time, cancellation, memory deletion, or no further provider calls. Those were covered by the named e2e test and live probe.
- `normal/single-pass-100.bru` does not assert provider/model fields. `normal/async-202.bru` checks the accepted 202 shape but allows either queued or running.
- `tools/run-chunked-bruno.sh` includes normal, slow, transient, and failure modes but no boundary/retention/restart modes. It points at 3996/3999 and was intentionally not executed per review instructions.

## Findings

### Medium — Bruno “250 activities” request actually creates 101

**File:** `bruno/taskory/reports/chunked/normal/async-202.bru`

**Reproduction:** run the normal Bruno folder; its setup loop inserts 101 activities, then its assertion expects `progress.total` to equal 2. The docs describe the request as the spec's 250-activity scenario.

**Expected:** insert 250 activities, assert total 3, and exercise chunk sizes 100/100/50 in date order.

**Actual:** inserts 101 and checks a total of 2. The e2e/runner tests and the runtime probe cover the implementation's 250 behavior, but the Bruno request is not faithful to its spec reference.

**Severity:** Medium (traceability/acceptance coverage gap; no runtime endpoint defect reproduced).

### Low — Running GET status shape has no named test or Bruno assertion

**Reproduction:** the API returns the common status fields in `ReportsService.status`, but no named test asserts the running GET response or the `progress.done` bounds. The async Bruno request allows queued/running only on POST and does not poll/assert a running response.

**Expected:** a named test and/or request should poll while running and check `id`, `status`, `progress`, `createdAt`, `finishedAt`, and `0 <= done <= total`.

**Actual:** the shape is implemented and was observed during live polling, but its contract is not locked by a named test or Bruno assertion.

**Severity:** Low (verification gap).

### Low — Localized `INVALID_LLM_OUTPUT` response message is not asserted

The English and Spanish strings exist, and the status/error code behavior is covered. The Bruno/e2e tests assert Spanish conflict and non-retryable messages, but no named test asserts the Spanish invalid-output message specifically.

**Expected:** verify that a failed job localized with `Accept-Language: es` retains code `INVALID_LLM_OUTPUT` and returns its Spanish message.

**Actual:** implementation mapping exists in `messages.ts`; this exact localized response behavior is untested by name and absent from Bruno.

**Severity:** Low (verification gap).

## Limits of this review

I did not execute Jest/Vitest suites or `tools/run-chunked-bruno.sh`; test names and code assertions were inspected. Retention expiry was verified by named tests and code, not by aging a live report 30 days. Prompt containment was verified from named unit tests/source because the checked-in fake does not log prompts. No repo source or git state was modified; only this review report was created.
