# Fake Ollama

Run `node tools/fake-ollama/server.mjs`. It implements `/api/tags`, `/api/chat`, and `GET /__stats` on port 3996 by default. Set `FAKE_OLLAMA_PORT` or `FAKE_OLLAMA_DELAY_MS` to change the port or add latency. `FAKE_OLLAMA_FAIL_CHUNK` selects a 1-based chunk by its activity IDs; `FAKE_OLLAMA_FAIL_TIMES` (default `1`) sets how many consecutive attempts for that chunk return HTTP 500 before succeeding. `FAKE_OLLAMA_INVALID_JSON=1` instead makes every attempt for the selected chunk return HTTP 200 with invalid JSON content. `/__stats` reports evaluation calls per chunk, including retries.

Run `node --test tools/fake-ollama/server.test.mjs` from the repository root to verify chunk-scoped failure and invalid-output behavior and stats.

After building `packages/llm`, run `node --test tools/fake-ollama/library-prompts.test.mjs` from the repository root to verify answers against the library's current chunk evaluation, consolidation, and final report prompts.
