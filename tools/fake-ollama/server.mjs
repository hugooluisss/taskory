import { createServer } from "node:http";

const port = Number(process.env.FAKE_OLLAMA_PORT ?? 3996);
const delayMs = Number(process.env.FAKE_OLLAMA_DELAY_MS ?? 0);
const failChunk = Number(process.env.FAKE_OLLAMA_FAIL_CHUNK ?? 0);
const failTimes = Number(process.env.FAKE_OLLAMA_FAIL_TIMES ?? 1);
const invalidJson = process.env.FAKE_OLLAMA_INVALID_JSON === "1";
const chunkStats = new Map();
const chunkNumbers = new Map();

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function blockJson(prompt, tag) {
  const startTag = `<${tag}>`;
  const start = prompt.indexOf(startTag);
  const end = prompt.indexOf(`</${tag}>`);
  if (start < 0 || end < 0) {
    return [];
  }
  return JSON.parse(prompt.slice(start + startTag.length, end).trim());
}

function firstUserPrompt(messages) {
  return (
    messages.filter((message) => message.role === "user").at(-1)?.content ?? ""
  );
}

async function readRequest(request) {
  let body = "";
  for await (const part of request) {
    body += part;
  }
  return JSON.parse(body);
}

function buildChunkEvaluation(activities) {
  const selected = activities.filter(
    (activity, index) => index === 0 || index === 2,
  );
  const highlights = selected.map((activity) => ({
    activityId: activity.id,
    impact: activity === activities[0] ? "high" : "medium",
    reason: "fake",
  }));
  return JSON.stringify({ summary: "Fake summary", highlights });
}

function buildConsolidation(prompt) {
  const chunks = blockJson(prompt, "activity_json");
  const highlights = chunks
    .flatMap((chunk) => chunk.highlights ?? [])
    .sort(
      (left, right) =>
        (left.impact === "high" ? 0 : 1) - (right.impact === "high" ? 0 : 1),
    )
    .slice(0, 15);
  return JSON.stringify({ summary: "Fake summary", highlights });
}

function buildFinalReport(prompt) {
  const { memory } = blockJson(prompt, "memory_json");
  return ["# Fake report", ...memory.map((chunk) => chunk.summary)].join("\n");
}

function buildContent(task, prompt, activities) {
  if (task === "TASK: CHUNK_EVALUATION") {
    return buildChunkEvaluation(activities);
  }
  if (task === "TASK: CONSOLIDATION") {
    return buildConsolidation(prompt);
  }
  if (task === "TASK: FINAL_REPORT") {
    return buildFinalReport(prompt);
  }
  return "# Report";
}

async function handleChat(request, response) {
  const body = await readRequest(request);
  const prompt = firstUserPrompt(body.messages ?? []);
  const task = prompt.split(/\r?\n/, 1)[0];
  if (task === "TASK: CHUNK_EVALUATION") {
    const activities = blockJson(prompt, "activity_json");
    const chunkKey = activities.map((activity) => activity.id).join(",");
    const calls = (chunkStats.get(chunkKey) ?? 0) + 1;
    chunkStats.set(chunkKey, calls);
    if (!chunkNumbers.has(chunkKey))
      chunkNumbers.set(chunkKey, chunkNumbers.size + 1);
    const chunkNumber = chunkNumbers.get(chunkKey);
    if (chunkNumber === failChunk && invalidJson) {
      json(response, 200, { message: { content: "not valid JSON" } });
      return;
    }
    if (chunkNumber === failChunk && calls <= failTimes) {
      json(response, 500, {
        error: `Configured failure for chunk ${chunkNumber}, attempt ${calls}`,
      });
      return;
    }
  }
  const activities =
    task === "TASK: CHUNK_EVALUATION"
      ? blockJson(prompt, "activity_json")
      : undefined;
  json(response, 200, {
    message: { content: buildContent(task, prompt, activities) },
  });
}

async function handleRequest(request, response) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  if (request.method === "GET" && request.url === "/__stats") {
    json(response, 200, {
      chunkEvaluationCalls: Array.from(chunkNumbers, ([key, chunk]) => ({
        chunk,
        calls: chunkStats.get(key),
      })),
    });
    return;
  }
  if (request.method === "GET" && request.url === "/api/tags") {
    json(response, 200, { models: [{ name: "fake" }] });
    return;
  }
  if (request.method === "POST" && request.url === "/api/chat") {
    await handleChat(request, response);
    return;
  }
  json(response, 404, { error: "Not found" });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const detail = error.stack ?? String(error);
    process.stderr.write(`${detail}\n`);
    json(response, 500, {
      error: `Fake Ollama failed to build an answer: ${error.message}`,
      detail,
    });
  });
});

server.listen(port, () => {
  process.stdout.write(`Fake Ollama listening on ${port}\n`);
});
