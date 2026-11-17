import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, test } from "node:test";

const { buildChunkEvaluationPrompt } =
  await import("../../packages/llm/dist/report/chunk-evaluation.prompt.js");
const { buildConsolidationPrompt } =
  await import("../../packages/llm/dist/report/consolidation.prompt.js");
const { buildFinalReportPrompt } =
  await import("../../packages/llm/dist/report/final-report.prompt.js");
const port = await unusedPort();
const server = spawn(
  process.execPath,
  [new URL("./server.mjs", import.meta.url).pathname],
  {
    env: {
      ...process.env,
      FAKE_OLLAMA_PORT: String(port),
      FAKE_OLLAMA_FAIL_CHUNK: "0",
    },
    stdio: "ignore",
  },
);

after(async () => {
  server.kill("SIGTERM");
  await once(server, "exit");
});

test("answers current library prompts for all report stages", async () => {
  await waitUntilReady(port, server);
  const activity = {
    id: "activity-1",
    date: "2026-11-16",
    title: "Delivered work",
    description: null,
    referenceUrls: [],
    tags: [],
    project: "Taskory",
  };
  const evaluationPrompt = buildChunkEvaluationPrompt([activity], "en");
  const evaluationResponse = await postPrompt(port, evaluationPrompt.prompt);
  assert.equal(evaluationResponse.status, 200);
  const evaluation = JSON.parse(evaluationResponse.body.message.content);
  assert.equal(evaluation.summary, "Fake summary");
  assert.equal(evaluation.highlights[0].activityId, activity.id);

  const memory = [
    {
      chunkIndex: 0,
      dateFrom: activity.date,
      dateTo: activity.date,
      activityCount: 1,
      summary: "Fake summary",
      highlights: [
        {
          activityId: activity.id,
          date: activity.date,
          title: activity.title,
          project: activity.project,
          impact: "high",
          reason: "fake",
        },
      ],
    },
  ];
  const consolidationPrompt = buildConsolidationPrompt(memory, "en");
  const consolidationResponse = await postPrompt(
    port,
    consolidationPrompt.prompt,
  );
  assert.equal(consolidationResponse.status, 200);
  const consolidation = JSON.parse(consolidationResponse.body.message.content);
  assert.equal(consolidation.summary, "Fake summary");
  assert.equal(consolidation.highlights[0].activityId, activity.id);

  const finalPrompt = buildFinalReportPrompt({
    memory,
    totals: { byProject: { Taskory: 1 }, byDay: { [activity.date]: 1 } },
    from: activity.date,
    to: activity.date,
    language: "en",
    style: "summary",
  });
  const finalResponse = await postPrompt(port, finalPrompt.prompt);
  assert.equal(finalResponse.status, 200);
  assert.equal(
    finalResponse.body.message.content,
    "# Fake report\nFake summary",
  );
});

async function postPrompt(port, prompt) {
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  return { status: response.status, body: await response.json() };
}

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
    if (child.exitCode !== null)
      throw new Error("Fake Ollama exited before listening");
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/tags`)).ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error("Fake Ollama did not become ready");
}
