import {
  matchesRegisteredRedirect,
  validateRedirectUri,
} from "./redirect-uri.validator";

describe("Dynamic client registration redirect URI validation", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "http://evil.com/cb",
    "https:///cb",
    "http:/cb",
    "https://x.com/cb#frag",
    "https://x.com/cb\r",
    "https://x.com/cb\n",
    "https://x.com/cb\t",
    "https://x.com/cb path",
    "https://x.com/cb\u0000",
    "https://x.com/cb\u007f",
    "https://*.x.com/cb",
    "https://user:pw@x.com/cb",
    "file:///etc/passwd",
    "vbscript:x",
    "abc:def",
  ])("Rejects unsafe URI %s", (uri) => {
    expect(validateRedirectUri(uri).valid).toBe(false);
  });

  it.each([
    "http://localhost:3000/cb",
    "http://127.0.0.1/cb",
    "http://[::1]:8080/cb",
    "https://app.example.com/cb",
    "cursor://anysphere.cursor-mcp/oauth/callback",
    "vscode://x",
  ])("Accepts safe URI %s", (uri) => {
    expect(validateRedirectUri(uri)).toEqual({ valid: true });
  });

  it("Matches registered redirect URIs exactly", () => {
    expect(
      matchesRegisteredRedirect(
        ["https://app.example/cb"],
        "https://app.example/cb",
      ),
    ).toBe(true);
    expect(
      matchesRegisteredRedirect(
        ["https://app.example/cb"],
        "https://app.example/cb/",
      ),
    ).toBe(false);
  });
});
