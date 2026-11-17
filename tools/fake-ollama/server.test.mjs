import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, test } from "node:test";

const port = await unusedPort();
const server = spawn(
  process.execPath,
  [new URL("./server.mjs", import.meta.url).pathname],
  {
    env: {
      ...process.env,
      FAKE_OLLAMA_PORT: String(port),
      FAKE_OLLAMA_FAIL_CHUNK: "2",
      FAKE_OLLAMA_FAIL_TIMES: "2",
    },
    stdio: "ignore",
  },
);
after(async () => {
  server.kill("SIGTERM");
  await once(server, "exit");
});

test("configured 1-based chunk fails for the configured attempts", async () => {
  await waitUntilReady(port, server);
  assert.equal((await evaluateChunk(port, "first-chunk")).status, 200);
  assert.equal((await evaluateChunk(port, "second-chunk")).status, 500);
  assert.equal((await evaluateChunk(port, "second-chunk")).status, 500);
  assert.equal((await evaluateChunk(port, "second-chunk")).status, 200);
  assert.deepEqual(await stats(port), {
    chunkEvaluationCalls: [
      { chunk: 1, calls: 1 },
      { chunk: 2, calls: 3 },
    ],
  });
});

test("consolidation returns at most 15 highlights with high impact first", async () => {
  await waitUntilReady(port, server);
  const highlights = Array.from({ length: 20 }, (_, index) => ({
    activityId: `id-${index}`,
    impact: index === 19 ? "high" : "medium",
    reason: "reason",
  }));
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: `TASK: CONSOLIDATION\n<activity_json>${JSON.stringify([{ highlights }])}</activity_json>`,
        },
      ],
    }),
  });
  const body = await response.json();
  const result = JSON.parse(body.message.content);
  assert.equal(result.highlights.length, 15);
  assert.equal(result.highlights[0].impact, "high");
});

test("default failure count is one attempt for the second chunk", async () => {
  const defaultPort = await unusedPort();
  const child = spawn(
    process.execPath,
    [new URL("./server.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        FAKE_OLLAMA_PORT: String(defaultPort),
        FAKE_OLLAMA_FAIL_CHUNK: "2",
        FAKE_OLLAMA_FAIL_TIMES: "1",
      },
      stdio: "ignore",
    },
  );
  try {
    await waitUntilReady(defaultPort, child);
    assert.equal((await evaluateChunk(defaultPort, "one")).status, 200);
    assert.equal((await evaluateChunk(defaultPort, "two")).status, 500);
    assert.equal((await evaluateChunk(defaultPort, "two")).status, 200);
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
});

test("invalid JSON mode returns HTTP 200 with invalid chunk output on every attempt", async () => {
  const invalidPort = await unusedPort();
  const child = spawn(
    process.execPath,
    [new URL("./server.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        FAKE_OLLAMA_PORT: String(invalidPort),
        FAKE_OLLAMA_FAIL_CHUNK: "2",
        FAKE_OLLAMA_INVALID_JSON: "1",
      },
      stdio: "ignore",
    },
  );
  try {
    await waitUntilReady(invalidPort, child);
    assert.equal((await evaluateChunk(invalidPort, "first")).status, 200);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await evaluateChunk(invalidPort, "second");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).message.content, "not valid JSON");
    }
    assert.deepEqual(await stats(invalidPort), {
      chunkEvaluationCalls: [
        { chunk: 1, calls: 1 },
        { chunk: 2, calls: 3 },
      ],
    });
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
});

async function unusedPort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  listener.close();
  await once(listener, "close");
  return address.port;
}

async function waitUntilReady(port, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("Fake Ollama exited before listening");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/tags`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error("Fake Ollama did not become ready");
}

async function evaluateChunk(port, id) {
  return fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: `TASK: CHUNK_EVALUATION\n<activity_json>[{"id":"${id}"}]</activity_json>`,
        },
      ],
    }),
  });
}

async function stats(port) {
  return (await fetch(`http://127.0.0.1:${port}/__stats`)).json();
}
