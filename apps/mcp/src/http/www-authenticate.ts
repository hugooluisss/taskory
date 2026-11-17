export function wwwAuthenticate(publicUrl: string, mcpPath = "/mcp"): string {
  const suffix = mcpPath === "/mcp" ? "" : mcpPath;
  return `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource${suffix}"`;
}
