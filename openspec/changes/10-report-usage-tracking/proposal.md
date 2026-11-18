# Report usage tracking

Move report provider and model selection to server configuration, account for every LLM completion in a report run, and persist a user-owned history of completed and failed runs.

## Motivation

Per-request provider selection makes reports inconsistent across users and omits usage history. Server-wide settings provide one predictable execution path, while persisted run records make consumed tokens and report inputs auditable.

## Scope

- Remove provider and model request overrides and the provider availability endpoint and form controls.
- Return and persist provider, model, and total token usage for synchronous and chunked report executions, including failures and retries.
- Add a paginated, newest-first, user-scoped report run history endpoint and show usage on the web report result.
- Document server configuration and the API contract.
