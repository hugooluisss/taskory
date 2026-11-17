export function wwwAuthenticate(publicUrl: string): string {
  return `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`;
}
