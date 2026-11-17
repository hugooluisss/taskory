# Rules for every coding agent

Read this file first, then the OpenSpec change you were assigned (`openspec/changes/<change>/`: proposal.md, specs/**/spec.md, design.md, tasks.md) and `docs/api-contract.md`. The specs are the source of truth; if code and spec disagree, the spec wins. Report contradictions instead of silently deviating.

## Style: ponytail
Apply the ponytail skill to ALL code you write. Read `/home/agent-server/.claude/plugins/marketplaces/ponytail/skills/ponytail/SKILL.md` and follow it: smallest working solution, reuse before writing, stdlib/native/installed deps first, no speculative abstractions, no config for values that never change, one runnable check for non-trivial logic.

Ponytail governs how much logic you write, NOT how you organize it. The structure below is mandatory and is never "simplified" into fewer files.

## Architecture: controller -> service -> repository (mandatory)
- Backend: controller = request in / response out (parse, validate DTO, call ONE service, shape response). Service = business rules. Repository = the only layer touching the database. No business rules in controllers, no data access outside repositories, no controller -> repository calls.
- Angular: controller = component class (view state and events only, never `HttpClient`, no business rules). Service = view-independent rules. Repository = the only layer calling the HTTP API.
- MCP: tool handler = controller; service = rules; API client = repository.
- packages/llm: `ReportGenerator` = service; providers = repositories.

## Code organization (clean architecture, everything in its place)
- One responsibility per file; one class (or one cohesive set of types) per file. No file mixing controller, service, repository, DTOs or entities.
- Feature folders, e.g. `apps/api/src/<feature>/{<feature>.controller.ts, <feature>.service.ts, <feature>.repository.ts, dto/, entities/, <feature>.module.ts}`. Shared code in `common/`.
- Angular: `core/` (repositories, guards, interceptors), `features/<feature>/` (pages as controllers with their own `.html`/`.css`, services), `shared/`. Templates in their own `.html` files, never inline walls of markup.
- Lines readable: one statement per line, no code golf, no giant one-line templates or chained one-liners.
- Constants and error codes in their own modules, no magic strings/numbers scattered.
- Tests next to the unit they cover, named after it.

## Testing (mandatory, with a real framework)
- `apps/api`: Jest + ts-jest; unit tests per service/repository with fakes; e2e with supertest and the real Nest app on an in-memory/temporary SQLite. Scripts: `npm test`, `npm run test:e2e`, `npm run test:cov`.
- `apps/web`: Vitest (Angular's default runner) with TestBed for components, services, repositories (HttpTestingController) and the interceptor. Scripts: `npm test`, `npm run test:cov`.
- `packages/llm` and `apps/mcp`: Vitest, with `fetch` injected/mocked (no real network or LLM calls). Script `npm test`, `npm run test:cov`.
- Do not use hand-rolled assert scripts as a substitute for the framework.
- Test names mirror the OpenSpec scenario they verify (`describe('<Requirement>')`, `it('<Scenario>')`) so every scenario is traceable to a test.
- Coverage gate: configure the framework's coverage threshold at 80% lines/branches for services and controllers; `npm run test:cov` must pass it.
- Test one layer at a time: services with fake repositories, controllers via e2e, repositories against a temporary database. No test may depend on another test's state or on a fixed port.

## Quality gates
- Typed everywhere, no `any` unless justified in a comment.
- Validate input at the boundary; never swallow exceptions; never log secrets.
- Every spec scenario you implement has a test. Build and tests must pass before you report done.
- Tick the checkbox of each task in the change's `tasks.md` (`- [ ]` -> `- [x]`) ONLY for tasks you completed and verified. Leave review tasks (revisión) for the architect.

## Boundaries
- Only touch the folders named in your assignment.
- Never run `git add`, `git commit`, `git push`, `git stash`, `git reset` or any git write command. Leave changes in the working tree.
- Never delete files outside your assigned folders. Do not install global packages.
- Do not run formatters over the repo; the architect formats after review.
- If something in the spec is ambiguous or impossible, stop and report it in your final message instead of guessing.

## Final report (your last message)
List: tasks completed (by number), files created, commands run with pass/fail results, deviations from spec/design, open issues. Be concise.
