## Decisions

### Project description
- `projects.description` nullable text, max 1000 characters, edited on create/update (API, MCP, web projects page and the create-new flow).
- Every project involved in a report (the selected ones, or the projects of the included activities when none is selected) is passed to the pipeline as `{name, description}` and rendered in the chunk-evaluation prompt and the final-report prompt inside the delimited data block, so it is treated as data, never as instructions. Projects without description are listed by name only.

### Reports as persisted items
- The existing `ReportJob` entity/table is the persisted report; API naming is "report". Minimal refactor: no table rename.
- Every generation creates the row: the synchronous path (<= sync max) also stores a `completed` row with markdown, params, activityIds, provider/model/usage/cost. `POST /reports` keeps its current 200/202 contract and now includes `id` in both.
- The 30-day purge of jobs is removed: reports live until the user deletes them. Only the share link expires.
- Derived title: `<from> – <to>` plus project names (computed, not stored).
- Reports list: `GET /reports` paginated, newest first, summary fields only (no markdown): `id,status,from,to,language,style,projects:[{id,name}],activityCount,provider,model,totalTokens,costUsd,createdAt,finishedAt`.
- Detail: `GET /reports/:id` returns the above plus `markdown`, `customPrompt` (if custom), progress/error, and share info (`shareUrl` only when a token was just created, `shareExpiresAt`).
- Regeneration: `POST /reports/:id/regenerate {style, customPrompt?, language?}` updates the stored params and reruns generation over the SAME activity snapshot (activityIds), reusing the queue and retry machinery; it overwrites markdown and usage of the item; each attempt still adds a `report_runs` row. Saving a custom prompt follows the rules of change 11. Regenerating a running report is refused (409).
- Activities removed after the snapshot are skipped when rendering evidence.

### Sharing
- Each report gets a share token at creation: 32 random bytes, base64url, stored only as SHA-256 (`shareTokenHash`, `shareExpiresAt = creation + 30 days`). The raw token is returned once at creation as `shareUrl` and again only when the owner renews it.
- `POST /reports/:id/share/renew` issues a new token (old one stops working) and a new 30-day expiry; the owner sees the new URL once. The detail page therefore shows the QR only right after creation or renewal; otherwise it offers "Renew link".
- Link base is `WEB_PUBLIC_URL` (env, e.g. `https://host/taskory-web`), URL form `<WEB_PUBLIC_URL>/shared/<token>`. The API refuses to build links when it is unset in production.
- Public read-only endpoint `GET /api/v1/shared/:token` (no auth, rate limited, `Cache-Control: no-store`, `noindex`): returns period, language, project names and the included activities (`date,title,description,projects,tags,referenceUrls`), ordered by date. It does NOT return the generated markdown, the prompt, tokens/cost, user data or ids. Unknown token → 404; expired → 410 `SHARE_EXPIRED`.
- Deleting a report invalidates its link.
- Token comparison by hash lookup (indexed unique), never the raw token in logs.

### Web
- `/reports` becomes the library: a list of report items (status, period, projects, style, date) with a "New report" action that opens the existing form; submitting creates the item and navigates to its detail page, which shows progress and then the result.
- `/reports/:id`: rendered markdown, metadata (provider, model, tokens, cost), prompt panel (style select, visible predefined prompt or editable custom textarea, language) with a Regenerate button, copy markdown, delete, print.
- QR: generated in the browser (`qrcode` package, SVG) from the share URL; shown in the detail page after creation/renewal and printed at the end of the print layout together with the URL and expiry date ("Activities included — valid until <date>"). The print stylesheet hides the app chrome. The downloaded/copied markdown ends with the same link line when the URL is known.
- `/shared/:token` (public route, no auth guard, no navbar): read-only list of included activities, a friendly page for expired/unknown links. es/en follow the report language.

### MCP
- `list_projects` returns descriptions; `create`/`update` of project description through new `create_project` and `update_project` tools; `generate_report` result includes `id` and `shareUrl`; new `list_reports` (summaries) and `get_report` (markdown) tools.

## Risks
- The public endpoint exposes activity text to anyone holding the link for 30 days: mitigated by 256-bit tokens, hashing, expiry, no-store, rate limit, owner renewal/delete.
- Reports now live indefinitely: storage grows with markdown; acceptable for the expected volume (hundreds per year).
