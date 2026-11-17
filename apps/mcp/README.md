# Taskory MCP Server

Taskory MCP exposes activity and report tools over stateless Streamable HTTP. It runs on port `3100` by default and forwards each caller's bearer token to the Taskory API. The server does not store its own API credentials.

## Configuration

Set these values in the process environment before starting the server. `.env.example` lists the supported variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3100` | HTTP port for the MCP server. |
| `TASKORY_API_URL` | `http://localhost:3999/api/v1` | Taskory REST API base URL. |
| `PUBLIC_URL` | `http://localhost:3999` | Public API URL used for OAuth resource discovery. |

`PORT` must be an integer from 1 through 65535. Both URLs must use HTTP or HTTPS. `PUBLIC_URL` is an origin without a path, query, or fragment.

## Run locally

From `apps/mcp`:

```sh
npm install
npm run build
npm start
```

The health endpoint is `http://localhost:3100/health`; MCP clients connect to `http://localhost:3100/mcp`. For example: `PORT=3100 TASKORY_API_URL=http://localhost:3999/api/v1 PUBLIC_URL=http://localhost:3999 npm start`.

## Connect an agent

In an OAuth-capable MCP client, add the MCP URL `http://localhost:3100/mcp`. The server returns the OAuth protected-resource metadata challenge and validates the access token through Taskory. No manual key is needed for the OAuth flow.

For clients configured to use a personal API key instead, set the connection's Authorization header to `Bearer <Taskory API key>`. The server forwards that key per request and never holds a shared credential.

## Security notes

Zod 4.6.7 is used to address GHSA-mrhx-c7xc-m3w5. Tool schemas cap URL and tag arrays at 20 entries, and the MCP SDK limits request bodies to 4 MiB.
