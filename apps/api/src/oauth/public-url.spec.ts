import { getMcpResource, getPublicUrl } from "./public-url";

describe("Issuer URL validation", () => {
  const originalUrl = process.env.PUBLIC_URL;
  const originalEnvironment = process.env.NODE_ENV;
  const originalMcpPath = process.env.MCP_PATH;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.PUBLIC_URL;
    else process.env.PUBLIC_URL = originalUrl;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    if (originalMcpPath === undefined) delete process.env.MCP_PATH;
    else process.env.MCP_PATH = originalMcpPath;
  });

  it("Normalizes a production HTTPS origin", () => {
    process.env.PUBLIC_URL = "https://taskory.example/";
    process.env.NODE_ENV = "production";
    expect(getPublicUrl()).toBe("https://taskory.example");
  });

  it.each([
    "http://taskory.example",
    "https://user:pass@taskory.example",
    "https://taskory.example/path",
    "https://taskory.example?query=1",
    "https://taskory.example#fragment",
    "relative/path",
  ])("Rejects invalid production issuer %s", (value) => {
    process.env.PUBLIC_URL = value;
    process.env.NODE_ENV = "production";
    expect(() => getPublicUrl()).toThrow("PUBLIC_URL");
  });

  it("Requires PUBLIC_URL in production", () => {
    delete process.env.PUBLIC_URL;
    process.env.NODE_ENV = "production";
    expect(() => getPublicUrl()).toThrow(
      "PUBLIC_URL is required in production",
    );
  });

  it("Allows loopback HTTP outside production", () => {
    process.env.PUBLIC_URL = "http://localhost:3000";
    process.env.NODE_ENV = "test";
    expect(getPublicUrl()).toBe("http://localhost:3000");
  });

  it("Validates configurable MCP paths", () => {
    process.env.MCP_PATH = "/taskory-mcp";
    expect(getMcpResource()).toBe("http://localhost:3999/taskory-mcp");
    for (const MCP_PATH of ["mcp", "/mcp/", "/mcp?x=1", "/mcp#x"]) {
      process.env.MCP_PATH = MCP_PATH;
      expect(() => getMcpResource()).toThrow("MCP_PATH");
    }
  });

  it("Rejects non-loopback HTTP outside production", () => {
    process.env.PUBLIC_URL = "http://example.com";
    process.env.NODE_ENV = "test";
    expect(() => getPublicUrl()).toThrow("HTTP PUBLIC_URL is allowed only");
  });
});
