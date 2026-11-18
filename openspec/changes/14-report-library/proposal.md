# Report library, project descriptions and shareable evidence

Reports are currently transient: small ones are returned once and never stored, large ones are purged after 30 days. This change turns each report into a persisted item the user can reopen, re-prompt and regenerate, gives projects a description that feeds the report prompt, and lets each report publish its included activities through a 30-day link shown as a QR in the report document.

## Scope

API (project description, persisted reports with listing/detail/regeneration, share links and a public read-only endpoint), `packages/llm` (project context in prompts), MCP (descriptions, report id and share URL), web (project description field, reports list and detail pages, regeneration, QR, print layout, public shared page), docs. The chunk size / activity cap / one-run-row work of change 11 stays out of scope.
