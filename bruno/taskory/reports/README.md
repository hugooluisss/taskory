# Reports Bruno requests

Run deterministic requests from the collection root with:

```sh
bru run reports --env local
```

The successful, detailed-style, and ANY-of tag report requests are tagged `requires-llm` and live in their own folder. Run them only when Ollama is available:

```sh
bru run reports/requires-llm --env local -r
```

`RANGE_TOO_LARGE` is not covered over HTTP because creating more than 300 activities in a Bruno request is impractical; the e2e test covers that scenario.

Chunked report scenarios use the deterministic fake Ollama service, including completion polling and failure/retry. See [chunked/README.md](chunked/README.md) for commands and tag filters.

Chunked requests only run through tools/run-chunked-bruno.sh, which starts the fake Ollama modes they need. Exclude them from recursive collection runs; for example:

```sh
bru run --env local -r --tests-only --exclude-tags=requires-llm,chunked
```
