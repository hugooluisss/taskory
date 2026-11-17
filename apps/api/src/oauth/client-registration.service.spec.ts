import { ClientRegistrationService } from "./client-registration.service";
import { OAuthError } from "./oauth-error";

describe("Dynamic client registration", () => {
  it("Register a client with valid metadata and deduplicated redirect URIs", async () => {
    const clients = { create: jest.fn().mockResolvedValue({ id: "client-1" }) };
    const service = new ClientRegistrationService(clients as never);
    await expect(
      service.register({
        client_name: "MCP client",
        redirect_uris: [
          "https://client.example/callback",
          "https://client.example/callback",
        ],
      }),
    ).resolves.toEqual({ id: "client-1" });
    expect(clients.create).toHaveBeenCalledWith({
      name: "MCP client",
      redirectUris: ["https://client.example/callback"],
    });
  });

  it("Reject hostile redirect URIs", async () => {
    const service = new ClientRegistrationService({
      create: jest.fn(),
    } as never);
    await expect(
      service.register({
        client_name: "Bad",
        redirect_uris: ["https://good.example/cb", "javascript:alert(1)"],
      }),
    ).rejects.toMatchObject({ error: "invalid_redirect_uri" });
  });

  it.each([
    [
      "confidential auth",
      { token_endpoint_auth_method: "client_secret_basic" },
    ],
    ["unsupported grant", { grant_types: ["client_credentials"] }],
    ["unsupported response", { response_types: ["token"] }],
    ["empty response types", { response_types: [] }],
    ["duplicate response types", { response_types: ["code", "code"] }],
  ])(
    "Reject unsupported registration metadata: %s",
    async (_scenario, metadata) => {
      const service = new ClientRegistrationService({
        create: jest.fn(),
      } as never);
      await expect(
        service.register({
          client_name: "Client",
          redirect_uris: ["https://client.example/cb"],
          ...metadata,
        }),
      ).rejects.toMatchObject({ error: "invalid_client_metadata" });
    },
  );

  it("Enforce client name and redirect URI count limits", async () => {
    const service = new ClientRegistrationService({
      create: jest.fn(),
    } as never);
    await expect(
      service.register({
        client_name: " ",
        redirect_uris: ["https://client.example/cb"],
      }),
    ).rejects.toBeInstanceOf(OAuthError);
    await expect(
      service.register({
        client_name: "x".repeat(101),
        redirect_uris: ["https://client.example/cb"],
      }),
    ).rejects.toMatchObject({ error: "invalid_client_metadata" });
    await expect(
      service.register({ client_name: "Client", redirect_uris: [] }),
    ).rejects.toMatchObject({ error: "invalid_client_metadata" });
    await expect(
      service.register({
        client_name: "Client",
        redirect_uris: Array.from(
          { length: 6 },
          (_, index) => `https://client.example/${index}`,
        ),
      }),
    ).rejects.toMatchObject({ error: "invalid_client_metadata" });
  });
});
