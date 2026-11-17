## Design review: phase 07 uncommitted deployment

Intent: deploy the web, API and MCP together with persistent SQLite, OAuth on one public origin, and optional Ollama.

### Findings

- **[must-fix][architecture] The published web port bypasses the documented trusted proxy.** `docker-compose.yml:10,54-55`, `apps/web/nginx.conf:1-4,24-29`, `README.md:5-7`: the port binds all host interfaces by default. When the recommended external TLS proxy is counted (`TRUST_PROXY_HOPS=2`), a client reaching the published port directly can supply `X-Forwarded-For`; nginx appends the client's actual address and Express trusts the preceding attacker-supplied address. Rotating it bypasses IP-based authentication/OAuth throttles. The client also controls `X-Forwarded-Proto`; `X-Forwarded-Host` and `Host` derive from its Host header. Bind the backend port to loopback or a restricted interface, ensure the outer proxy overwrites forwarding headers and cannot be bypassed, and document the exact trust boundary. Test both the direct and proxied paths. With the default one hop, Express selects nginx's immediate client and ignores earlier spoofed XFF entries, but all proxied users share the proxy's rate-limit identity until the count is increased.
- **[must-fix][bad practices] A fresh Ollama profile cannot generate reports.** `docker-compose.yml:12,14-15,71-78`, `README.md:17`, `packages/llm/src/providers/ollama.provider.ts:51-60`: the profile starts Ollama with an empty named volume but never pulls `llama3.2`; the API sends `/api/chat` for that model. Merely enabling the profile therefore does not fulfill the specified no-extra-configuration scenario. Provision the configured model as part of profile startup, with appropriate readiness/error handling, or change the specification and provide explicit model installation instructions. Verify report generation against a fresh volume.
- **[should-fix][bad practices] Restore and migration recovery are underspecified.** `README.md:9-15`, `apps/api/README.md:3`, `apps/api/src/migrations/1763400000000-InitialSchema.ts:25-41`: the stopped-API volume backup is a sensible consistent snapshot, but there is no restore procedure, ownership check, upgrade backup advice, or warning that reverting the initial migration drops all application tables. Document a tested restore with services stopped, ownership preserved for the `node` user, and a backup before upgrades; make clear that `down` destroys data. The initial migration assumes a fresh database and is not an upgrade path for databases previously created by synchronize; phase 04 explicitly says no prior deployed data, so document that limitation rather than silently implying compatibility.
- **[should-fix][tests] Deployment and security behavior lacks automated end-to-end evidence.** `apps/api/test/trust-proxy.e2e-spec.ts:42-65`, `apps/api/src/migrations/initial-schema.migration.spec.ts:23-52`, `openspec/changes/07-docker-deploy/tasks.md:14-19`: tests exercise Express with synthetic headers and migration schema parity, but do not exercise nginx plus its external proxy, consent response headers, OAuth discovery/routing, real MCP streaming, volume recreation, or the fresh Ollama profile. The task list claims startup and restart checks, but supplies no reproducible output; the full OAuth/MCP flow remains unchecked. Add focused integration checks covering these boundaries, including spoofed headers, and run the phase's end-to-end flow. Also exercise migration rollback on populated related tables and verify FK enforcement afterwards; the current test checks only the post-up pragma and migration bookkeeping, not `down`.
- **[should-fix][bad practices] Runtime configuration diverges from the deployment design.** `apps/web/Dockerfile:8-10`, `apps/web/src/app/core/config.service.ts:12`, `openspec/changes/07-docker-deploy/design.md:13`: the image serves the build-time `assets/config.json`, rather than generating it at startup. Its current same-origin defaults work, but operator-supplied runtime settings are not available as the design states. Either implement startup generation or update the design to explicitly adopt the static same-origin config.
- **[nit][bad practices] Deployment inputs are not fully reproducible.** `docker-compose.yml:72`, `apps/{api,mcp,web}/Dockerfile:1`, `apps/web/Dockerfile:8`: mutable image tags can resolve to different bases without source changes, and `ollama:latest` can change behavior independently. Pin tested image versions or digests and define an update process.

### Operational and security notes

- `.dockerignore:1-9` excludes `.env` files, databases, dependencies and build output from the context. The Dockerfiles pass JWT and provider secrets only at runtime and do not declare secret build arguments. This is source inspection, not an image-layer scan. Check for SQLite sidecars and backup archives placed inside copied app directories; the current ignore list does not explicitly exclude those.
- API and MCP declare `USER node`; the API creates `/data` owned by node before mounting the named volume. A fresh Docker-managed empty volume normally receives that ownership, but pre-existing or restored volumes need explicit ownership verification. The web uses the unprivileged nginx base. Ollama has no `user:` override and its image was unavailable locally, so its actual process UID and compliance with the all-containers non-root scenario are unverified.
- All three application services have local healthchecks and `unless-stopped`; `depends_on: service_healthy` gates initial startup. Compose does not restart a running container merely because its healthcheck becomes unhealthy. nginx uses Docker DNS with a short validity period to rediscover recreated upstreams. Ollama has neither healthcheck nor readiness dependency.
- No nested location declares `add_header`, so nginx's server-level CSP and X-Frame-Options are inherited by `/oauth/consent`, including error responses via `always`; future location-level `add_header` directives would replace that inheritance. This has not been confirmed over HTTP.
- MCP proxying sets HTTP/1.1, disables response buffering, forwards authorization/challenge headers, and allows one hour between upstream reads. It leaves request buffering and default send timeout in place; long-lived or slow streams have not been exercised. nginx's exact `/mcp` routing is consistent with the MCP server's exact path check.
- OAuth metadata and redirects call `getPublicUrl()` rather than deriving issuer from Host or forwarded headers (`apps/api/src/oauth/oauth-metadata.controller.ts:6-14`, `apps/api/src/oauth/public-url.ts:9-49`). Spoofed Host therefore does not change the issuer in the inspected paths. Production URL validation requires an HTTPS origin.
- Migration idempotence is provided by TypeORM's migration history, not `CREATE TABLE IF NOT EXISTS`; a second normal `runMigrations()` is tested as a no-op. `prepareDatabase` enables foreign keys, and the test checks the final pragma. Rollback and interrupted/partially existing schema behavior remain unverified.

### Spec fidelity map

| Scenario | Evidence | Assessment |
|---|---|---|
| One-command startup: Fresh server | Compose services, healthchecks and dependencies `docker-compose.yml:1-69`; checked task `tasks.md:15` | Plausible; prior check is asserted without logs, not rerun in this review. |
| Data persistence: Restart | Named volume at `docker-compose.yml:11,16-17,83-85`; checked task `tasks.md:16` | Configured; persistence of actual users and activities not independently verified. |
| Secret handling: Missing secret | Compose interpolation `docker-compose.yml:8`; API validation `apps/api/src/config.ts:12-18`; `apps/api/src/main.ts:7-10` | Enforced before service startup; Compose itself fails first when unset. No image-layer inspection. |
| Service wiring: Same-origin web | `apps/web/public/assets/config.json:1`, `apps/web/nginx.conf:24-30`, `docker-compose.yml:35` | Configured; no browser-through-proxy integration evidence. |
| Public URL: Discovery through the public origin | `apps/web/nginx.conf:32-38`, `apps/api/src/oauth/oauth-metadata.controller.ts:6-14` | Routing and issuer are configured; not exercised through nginx. |
| Public URL: Missing public URL | `docker-compose.yml:9`, `apps/api/src/oauth/public-url.ts:10-13` | Enforced; existing `public-url.spec.ts:33-39` tests production validation. |
| Optional Ollama: Profile enabled | `docker-compose.yml:12,71-78`, `packages/llm/src/providers/ollama.provider.ts:51-60` | **Not satisfied on a fresh volume:** no model provisioning. |
| Least privilege images: Process user | `apps/api/Dockerfile:24-25`, `apps/mcp/Dockerfile:14`, `apps/web/Dockerfile:8`, `docker-compose.yml:71-78` | API/MCP specified; web depends on base image; Ollama process UID unverified. Inspect all running containers. |

Phase 04 consent and issuer design: consent is served by the SPA (`apps/web/nginx.conf:20-22`), inherits anti-framing headers, and issuer comes from `PUBLIC_URL`; full real-client OAuth flow remains open (`tasks.md:17`). Phase 07's startup-generated `config.json` design decision is not implemented as noted above.

### Done well

- The initial migration is compared with the synchronized entity schema and checks that a second migration run does nothing.
- Runtime services are separated from build toolchains; MCP reaches the API over the internal network rather than accessing SQLite.

### Scores (orientative)

| Category | Weight | Score | Why |
|---|---:|---:|---|
| Architecture | 20% | 7/10 | One must-fix proxy trust-boundary flaw. |
| Bad practices | 15% | 3.5/10 | One must-fix, two should-fixes and one nit. |
| Antipatterns | 15% | 10/10 | No finding. |
| Design patterns | 15% | 10/10 | No finding. |
| Naming | 15% | 10/10 | No finding. |
| Tests | 15% | 8.5/10 | One should-fix for missing boundary and rollback coverage. |
| Formatting | 5% | N/A | No applicable repository-wide formatter for deployment files; no formatter run. |

**Global: 8.1/10 — Verdict: approve with changes.** Weighted over applicable categories; the architecture must-fix forces at least this verdict. The score does not mean the must-fix issues are safe to deploy.

### Review limits

Read-only source review and `JWT_SECRET=review-placeholder PUBLIC_URL=https://taskory.example docker compose config --quiet` (passed). No containers were started, no images built, no tests or formatters run, and no running deployment was inspected. The codebase-memory index did not contain this repository, so impact analysis used direct source search. Task numbers 4.1 and 4.2 were not checked off; this is one review, not an independent cross-review.
