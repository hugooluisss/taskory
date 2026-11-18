## 1. Project descriptions

- [x] 1.1 llm: project context in chunk and final prompts (escaped data block)
- [x] 1.2 API: `projects.description` (migration, DTOs, responses), plumb to the generator
- [x] 1.3 MCP: descriptions in list_projects, `create_project`, `update_project`
- [x] 1.4 Web: description on the projects page and the create-new flow

## 2. Report library (API)

- [ ] 2.1 Persist every report (sync path too), `id` in responses, drop age purge, `GET /reports` list, detail fields
- [ ] 2.2 `POST /reports/:id/regenerate`

## 3. Sharing (API)

- [ ] 3.1 Share token (hash, expiry, `WEB_PUBLIC_URL`), `shareUrl` once, renew, public `GET /shared/:token`, rate limit, delete invalidates

## 4. Web

- [ ] 4.1 Reports library list and detail page with prompt panel and regenerate
- [ ] 4.2 QR (browser-generated), print layout, public `/shared/:token` page

## 5. MCP

- [ ] 5.1 `generate_report` returns id and shareUrl; `list_reports`, `get_report`

## 6. Docs

- [ ] 6.1 api-contract, README (`WEB_PUBLIC_URL`), compose/env, bruno, web-design

## 7. Review

- [ ] 7.1 Architect review; security review of the public endpoint
