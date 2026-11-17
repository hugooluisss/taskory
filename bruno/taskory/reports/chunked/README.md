# Chunked report requests

From the repository root, run all five isolated modes with one command:

```sh
tools/run-chunked-bruno.sh
```

Chunked requests only run through this script because it starts the fake Ollama mode each request needs. For recursive collection runs, exclude both real-LLM and chunked requests with --exclude-tags=requires-llm,chunked.

The script starts and stops the fake Ollama and API for each mode on a per-run local port pair. It uses a temporary SQLite database, `JWT_SECRET=x`, and `AUTH_RATE_LIMIT=1000`. It runs `normal`, `slow` (`FAKE_OLLAMA_DELAY_MS=2000`), `transient` (`FAKE_OLLAMA_FAIL_CHUNK=2`, `FAKE_OLLAMA_FAIL_TIMES=1`), `failure` (`FAKE_OLLAMA_FAIL_CHUNK=2`, `FAKE_OLLAMA_FAIL_TIMES=3`), and `invalid` (`FAKE_OLLAMA_FAIL_CHUNK=2`, `FAKE_OLLAMA_INVALID_JSON=1`) by explicit folder path.

`RANGE_TOO_LARGE` (>3000 activities) is covered by the API e2e suite; creating that many activities over HTTP is not practical in Bruno. Requests requiring fake Ollama are tagged `requires-fake-ollama`; the failure request also has `requires-fake-ollama-failure`.
