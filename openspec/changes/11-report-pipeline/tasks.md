# Tasks

## Service: packages/llm

- [x] 1. Apply provider-aware consolidation limits with an environment override.
- [x] 2. Add a mocked-fetch regression for DeepSeek memory that fits without consolidation.
- [x] 3. Build and pass tests and coverage gates for packages/llm and apps/api.
- [x] 4. Rebuild the dev stack and verify the retried report completes with usage and Markdown output.

## Repository and controller

- [x] 5. Styles A (API + llm): `GET /reports/styles`, `style:"custom"` + `customPrompt`, `users.customReportPrompt` migration, report_runs.style accepts custom, fixed rules always appended.
- [x] 6. Styles B (MCP): custom style in `generate_report`, `list_report_styles`.
- [x] 7. Styles C (web): style selector with visible prompt, editable custom textarea saved per user, es/en.
- [x] 8. Docs: api-contract, bruno.
- [ ] 9. Next part: chunk size 50 (`REPORT_CHUNK_SIZE`), raise activity cap via env, one `report_runs` row per job.
