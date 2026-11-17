# Taskory web

Run these commands from `apps/web`:

- `npm install` installs the web client dependencies.
- `npm start` serves the client and proxies only `/api` to `http://localhost:3000`.
- `npm run build` creates the production app in `dist/web`.
- `npm test` runs Angular's Vitest suite once.
- `npm run test:cov` runs tests with V8 coverage and fails below 80% lines, branches, or functions for core services and repositories.

Set `API_PROXY_TARGET` to override the development API origin, for example `API_PROXY_TARGET=http://localhost:3999 npm start`.

The app loads runtime settings before bootstrap from `public/assets/config.json`:

```json
{ "apiBaseUrl": "/api/v1", "mcpUrl": "" }
```

An empty `mcpUrl` uses the current origin followed by `/mcp`. `marked` renders reports and Angular's `DomSanitizer` sanitizes the resulting HTML.

The consent component also refuses to show its controls when framed. Enforceable framing headers are a phase-07 nginx deployment requirement: the `/oauth/consent` response must include `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. This is not configured by the web app and must not be considered complete until phase 07 delivers and verifies those response headers.
