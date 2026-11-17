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
