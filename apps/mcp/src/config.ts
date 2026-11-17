export interface Config {
  port: number;
  taskoryApiUrl: string;
  publicUrl: string;
  mcpPath: string;
}

function validUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${name} must be an HTTP or HTTPS URL without credentials, query, or fragment.`,
    );
  }
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? "3100");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const taskoryApiUrl = validUrl(
    env.TASKORY_API_URL ?? "http://localhost:3999/api/v1",
    "TASKORY_API_URL",
  );
  const publicUrl = validUrl(
    env.PUBLIC_URL ?? "http://localhost:3999",
    "PUBLIC_URL",
  );
  if (taskoryApiUrl.pathname === "/") {
    throw new Error("TASKORY_API_URL must include the API base path.");
  }
  if (publicUrl.pathname !== "/") {
    throw new Error("PUBLIC_URL must not include a path.");
  }
  const mcpPath = env.MCP_PATH ?? "/mcp";
  if (
    !mcpPath.startsWith("/") ||
    mcpPath.endsWith("/") ||
    mcpPath.includes("?") ||
    mcpPath.includes("#")
  ) {
    throw new Error(
      "MCP_PATH must start with / and must not include a query, fragment, or trailing slash.",
    );
  }
  return {
    port,
    taskoryApiUrl: taskoryApiUrl.toString().replace(/\/+$/, ""),
    publicUrl: publicUrl.origin,
    mcpPath,
  };
}
