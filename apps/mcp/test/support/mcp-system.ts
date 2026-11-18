import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpServer } from "../../src/http/server.js";
import {
  startFakeTaskoryApi,
  type FakeTaskoryHandler,
} from "./fake-taskory-api.js";

export async function startMcpSystem(
  handler: FakeTaskoryHandler,
  options: {
    publicUrl?: string;
    mcpPath?: string;
    timeoutMs?: number;
    now?: () => Date;
    fetcher?: typeof fetch;
  } = {},
): Promise<{
  root: string;
  apiRequests: import("./fake-taskory-api.js").FakeTaskoryRequest[];
  connect(token: string): Promise<Client>;
  close(): Promise<void>;
}> {
  const api = await startFakeTaskoryApi(handler);
  const server = createHttpServer({
    port: 0,
    taskoryApiUrl: api.baseUrl,
    publicUrl: options.publicUrl ?? "https://taskory.test",
    mcpPath: options.mcpPath,
    timeoutMs: options.timeoutMs,
    now: options.now,
    fetcher: options.fetcher,
  });
  const root = await listen(server);
  return {
    root,
    apiRequests: api.requests,
    connect: (token) => connect(root, token, options.mcpPath),
    close: async () => {
      await Promise.all([close(server), api.close()]);
    },
  };
}

export function connect(
  root: string,
  token: string,
  mcpPath = "/mcp",
): Promise<Client> {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${root}${mcpPath}`),
    {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    },
  );
  return client.connect(transport).then(() => client);
}

export function contentText(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return result.content.find((item) => item.type === "text")?.text ?? "";
}

export function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  return once(server, "listening").then(() => {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("HTTP server failed to bind an ephemeral port.");
    return `http://127.0.0.1:${address.port}`;
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function withMcpClient<T>(
  handler: FakeTaskoryHandler,
  token: string,
  run: (context: {
    client: Client;
    system: Awaited<ReturnType<typeof startMcpSystem>>;
  }) => Promise<T>,
  options: {
    publicUrl?: string;
    mcpPath?: string;
    timeoutMs?: number;
    now?: () => Date;
  } = {},
): Promise<T> {
  return withMcpSystem(
    handler,
    async (system) => {
      const client = await system.connect(token);
      try {
        return await run({ client, system });
      } finally {
        await client.close();
      }
    },
    options,
  );
}

export async function withMcpSystem<T>(
  handler: FakeTaskoryHandler,
  run: (system: Awaited<ReturnType<typeof startMcpSystem>>) => Promise<T>,
  options: {
    publicUrl?: string;
    mcpPath?: string;
    timeoutMs?: number;
    now?: () => number;
  } = {},
): Promise<T> {
  const system = await startMcpSystem(handler, options);
  try {
    return await run(system);
  } finally {
    await system.close();
  }
}
