import { ApiKeysService } from "../api-keys/api-keys.service";
import { AuthService } from "./auth.service";
import { TokenAuthService } from "./token-auth.service";

describe("API key authentication", () => {
  it("Request with a valid key dispatches to the API key service", async () => {
    const user = {
      id: "u1",
      email: "key@example.com",
      name: "Key User",
      language: "en" as const,
    };
    const apiKeys = { authenticate: jest.fn().mockResolvedValue(user) };
    const auth = { authenticate: jest.fn() };
    const service = new TokenAuthService(
      auth as unknown as AuthService,
      apiKeys as unknown as ApiKeysService,
      { resolveAccessToken: jest.fn() },
    );

    await expect(service.authenticate("tk_secret")).resolves.toEqual(user);
    expect(apiKeys.authenticate).toHaveBeenCalledWith("tk_secret");
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it("Valid JWT dispatches to JWT authentication", async () => {
    const user = {
      id: "u1",
      email: "jwt@example.com",
      name: "JWT User",
      language: "en" as const,
    };
    const apiKeys = { authenticate: jest.fn() };
    const auth = { authenticate: jest.fn().mockResolvedValue(user) };
    const service = new TokenAuthService(
      auth as unknown as AuthService,
      apiKeys as unknown as ApiKeysService,
      { resolveAccessToken: jest.fn() },
    );

    await expect(service.authenticate("jwt-token")).resolves.toEqual(user);
    expect(auth.authenticate).toHaveBeenCalledWith("jwt-token");
    expect(apiKeys.authenticate).not.toHaveBeenCalled();
  });
});

describe("OAuth access token authentication", () => {
  it("Resolves a to_ token with the OAuth service", async () => {
    const user = {
      id: "u1",
      email: "oauth@example.com",
      name: "OAuth User",
      language: "en" as const,
    };
    const oauth = { resolveAccessToken: jest.fn().mockResolvedValue(user) };
    const service = new TokenAuthService(
      { authenticate: jest.fn() } as unknown as AuthService,
      { authenticate: jest.fn() } as unknown as ApiKeysService,
      oauth,
    );
    await expect(service.authenticate("to_secret")).resolves.toEqual(user);
    expect(oauth.resolveAccessToken).toHaveBeenCalledWith("to_secret");
  });
});
