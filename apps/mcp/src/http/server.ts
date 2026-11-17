import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { TaskoryApiClient } from "../repositories/taskory-api.client.js";
import { ApiError } from "../repositories/api-error.js";
import { UpstreamUnavailable } from "../repositories/taskory-api.client.js";
import { ActivityToolsService } from "../services/activity-tools.service.js";
import { ReportToolsService } from "../services/report-tools.service.js";
import { registerTools } from "../tools/register-tools.js";
import { bearerToken } from "./bearer-auth.js";
import { wwwAuthenticate } from "./www-authenticate.js";

export interface HttpServerOptions {
  port: number;
  taskoryApiUrl: string;
  publicUrl: string;
  mcpPath?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export function createHttpServer(options: HttpServerOptions): Server {
  const api = new TaskoryApiClient(
    options.taskoryApiUrl,
    options.fetcher,
    options.timeoutMs,
  );
  const http = createServer(async (request, response) => {
    await handleRequest(request, response, options, api);
  });
  return http;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpServerOptions,
  api: TaskoryApiClient,
): Promise<void> {
  const mcpPath = options.mcpPath ?? "/mcp";
  if (request.url === mcpPath) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Expose-Headers",
      "WWW-Authenticate, Mcp-Session-Id",
    );
  }
  if (request.method === "OPTIONS" && request.url === mcpPath) {
    response
      .writeHead(204, {
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, content-type, mcp-session-id, mcp-protocol-version, accept",
        "Access-Control-Max-Age": "600",
      })
      .end();
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (request.url !== mcpPath) {
    response.writeHead(404).end("Not found");
    return;
  }
  const token = bearerToken(request);
  const challenge = wwwAuthenticate(options.publicUrl, mcpPath);
  if (!token) {
    response.writeHead(401, { "WWW-Authenticate": challenge }).end();
    return;
  }
  try {
    await api.validateToken(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      response.writeHead(401, { "WWW-Authenticate": challenge }).end();
      return;
    }
    if (error instanceof ApiError) {
      const limited = error.status === 429;
      writeRpcError(
        response,
        limited ? 429 : 502,
        limited ? "RATE_LIMITED" : "UPSTREAM_REJECTED",
        limited
          ? "The Taskory API rate limit was reached; this can be retried"
          : "The Taskory API rejected the request",
        limited ? error.retryAfter : undefined,
      );
      return;
    }
    if (error instanceof UpstreamUnavailable) {
      writeRpcError(
        response,
        503,
        "UPSTREAM_UNAVAILABLE",
        "the Taskory API is temporarily unavailable; this can be retried",
        "5",
      );
      return;
    }
    writeRpcError(
      response,
      503,
      "UPSTREAM_UNAVAILABLE",
      "the Taskory API is temporarily unavailable; this can be retried",
      "5",
    );
    return;
  }
  const server = new McpServer({ name: "taskory", version: "1.0.0" });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void transport.close();
    void server.close();
  };
  response.once("close", close);
  registerTools(
    server,
    new ActivityToolsService(api, options.now),
    new ReportToolsService(api),
  );
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    if (!response.writableEnded) response.end("MCP request failed");
    close();
  }
}

function writeRpcError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  retryAfter?: string,
): void {
  response
    .writeHead(status, {
      "content-type": "application/json",
      ...(retryAfter === undefined ? {} : { "Retry-After": retryAfter }),
    })
    .end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: `${code}: ${message}`, data: { code } },
        id: null,
      }),
    );
}
