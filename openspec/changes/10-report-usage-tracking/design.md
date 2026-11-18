# Design

`ReportGenerator` continues to own the pipeline and receives a fixed provider and model from its process configuration. Each provider returns text and prompt, completion, and total token counts; missing usage fields are zero. The generator totals each count for every completion, including retries and consolidation. The API calculates the USD estimate using server-wide per-million-token prices, stores integer micro-dollars, and returns the cost as USD.

`ReportRunsRepository` persists one run row through `TransactionRunner`. Synchronous report requests save a completed run or a failed run with usage consumed so far. Chunk jobs save split token usage alongside each completed memory chunk so retries reuse the prior usage without recounting it; the runner writes the run record on either terminal outcome.

The report controller remains thin. `ReportsService` handles synchronous execution and history reads; the job runner handles asynchronous terminal persistence through the repository. History is paginated and scoped to the authenticated user. Provider/model are selected once from the existing `DEFAULT_LLM_PROVIDER` and `DEFAULT_LLM_MODEL` settings and are never accepted from callers.
