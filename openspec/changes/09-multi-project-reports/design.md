# Design

Use `projects?: string[]` throughout report generation. Validate at the API boundary (maximum 20; each trimmed value non-empty and at most 100 characters), trim and de-duplicate before querying or persisting. The snapshot query uses a bound `IN` list; empty or omitted values add no project predicate. Persisted jobs containing only the retired `project` field are treated as unfiltered. The web reuses `app-chips-input` with metadata suggestions and the MCP forwards the array unchanged.
