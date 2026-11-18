import { once } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";

export interface FakeTaskoryRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: unknown;
}

export interface FakeTaskoryResponse {
  status?: number;
  body?: unknown;
  closeSocket?: boolean;
  headers?: Record<string, string>;
  delayMs?: number;
}

export type FakeTaskoryHandler = (
  request: FakeTaskoryRequest,
) => FakeTaskoryResponse | undefined | Promise<FakeTaskoryResponse | undefined>;

export const defaultFakeTaskoryHandler: FakeTaskoryHandler = (request) => {
  if (request.url === "/api/v1/auth/me")
    return { body: { id: request.authorization } };
  if (request.url.startsWith("/api/v1/activities")) {
    if (request.method === "POST")
      return {
        status: 201,
        body: { id: "new-activity", date: "2026-02-28", title: "Work" },
      };
    if (request.method === "PATCH")
      return { body: { id: "activity-id", title: "Updated" } };
    if (request.method === "DELETE") return { status: 204 };
    return { body: { items: [], total: 0 } };
  }
  if (request.url === "/api/v1/reports" && request.method === "POST") {
    return {
      body: {
        markdown: "# Report",
        provider: "local",
        model: "test-model",
        totalTokens: 10,
        promptTokens: 7,
        completionTokens: 3,
        costUsd: 0,
        activityCount: 3,
      },
    };
  }
  if (request.url.startsWith("/api/v1/reports/")) {
    return {
      body: {
        id: "report-id",
        status: "completed",
        progress: { done: 1, total: 1 },
        markdown: "# Report",
        provider: "local",
        model: "test-model",
        totalTokens: 10,
        promptTokens: 7,
        completionTokens: 3,
        costUsd: 0,
        activityCount: 3,
      },
    };
  }
  return {
    status: 404,
    body: {
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Activity was not found.",
    },
  };
};

export interface FakeTaskoryApi {
  baseUrl: string;
  requests: FakeTaskoryRequest[];
  close(): Promise<void>;
}

export async function startFakeTaskoryApi(
  handler: FakeTaskoryHandler = defaultFakeTaskoryHandler,
): Promise<FakeTaskoryApi> {
  const requests: FakeTaskoryRequest[] = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const recorded: FakeTaskoryRequest = {
      method: request.method ?? "GET",
      url: request.url ?? "/",
      authorization: request.headers.authorization,
      body,
    };
    requests.push(recorded);
    const result = await handler(recorded);
    if (!result) return;
    if (result.delayMs)
      await new Promise((resolve) => setTimeout(resolve, result.delayMs));
    if (result.closeSocket) {
      response.socket?.destroy();
      return;
    }
    const responseBody = result.body;
    response.writeHead(result.status ?? 200, {
      ...(responseBody === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...result.headers,
    });
    if (responseBody === undefined) {
      response.end();
      return;
    }
    response.end(
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fake Taskory API failed to bind an ephemeral port.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    requests,
    close: () => close(server),
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
