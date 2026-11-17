# Multi-project reports

## Why

Reports currently filter to one project, which prevents useful reports across related projects.

## What Changes

- Replace the optional single report project filter with up to 20 project names. Matching uses OR semantics; no selection includes every project.
- Carry the selection through the API, report jobs, LLM generator, MCP tool, and web form.

## Capabilities

### Modified Capabilities
- `reports`
- `mcp-server`
- `web-client`

## Impact

API report request/job contracts, report generation prompts, MCP schema, web report form, and API contract documentation.
