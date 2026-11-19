import { createHash } from "node:crypto";
import { ApiKeysRepository } from "./api-keys.repository";
import { ApiKeysService } from "./api-keys.service";
import { UsersService } from "../users/users.service";

describe("API key creation", () => {
  const owner = {
    id: "owner-1",
    email: "owner@example.com",
    name: "Owner",
    language: "en" as const,
  };

  it("Create key", async () => {
    const repository = {
      createIfBelowLimit: jest.fn(async (values) => ({
        id: "key-1",
        ...values,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      })),
    };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    const result = await service.create("owner-1", "MCP");

    expect(result.key).toMatch(/^tk_/);
    expect(repository.createIfBelowLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner-1",
        name: "MCP",
        keyHash: createHash("sha256").update(result.key).digest("hex"),
      }),
      20,
    );
    expect(
      JSON.stringify(repository.createIfBelowLimit.mock.calls[0][0]),
    ).not.toContain(result.key);
  });

  it("Key is never shown again", async () => {
    const repository = {
      list: jest.fn().mockResolvedValue([
        {
          id: "key-1",
          name: "MCP",
          prefix: "tk_abcd",
          createdAt: new Date(),
          lastUsedAt: null,
          keyHash: "hash",
        },
      ]),
    };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    const result = await service.list("owner-1");

    expect(result[0]).toEqual(
      expect.objectContaining({ id: "key-1", name: "MCP", prefix: "tk_abcd" }),
    );
    expect(result[0]).not.toHaveProperty("key");
    expect(result[0]).not.toHaveProperty("keyHash");
  });
});

describe("API key limit", () => {
  it("Limit reached", async () => {
    const repository = {
      createIfBelowLimit: jest.fn().mockResolvedValue(null),
    };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    await expect(service.create("owner-1", "Too many")).rejects.toMatchObject({
      response: { code: "API_KEY_LIMIT" },
      status: 409,
    });
  });
});

describe("API key revocation and ownership", () => {
  it("Another user's key", async () => {
    const repository = { revoke: jest.fn().mockResolvedValue(false) };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    await expect(
      service.revoke("owner-1", "foreign-key"),
    ).rejects.toMatchObject({ response: { code: "NOT_FOUND" }, status: 404 });
    expect(repository.revoke).toHaveBeenCalledWith(
      "owner-1",
      "foreign-key",
      expect.any(Date),
    );
  });

  it("Revoke own key", async () => {
    const repository = { revoke: jest.fn().mockResolvedValue(true) };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    await expect(
      service.revoke("owner-1", "owned-key"),
    ).resolves.toBeUndefined();
  });
});

describe("API key authentication", () => {
  const owner = {
    id: "owner-1",
    email: "owner@example.com",
    name: "Owner",
    language: "en" as const,
  };

  it("Request with a valid key", async () => {
    const repository = {
      findActiveByHash: jest
        .fn()
        .mockResolvedValue({ id: "key-1", userId: "owner-1" }),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    const users = { findById: jest.fn().mockResolvedValue(owner) };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      users as unknown as UsersService,
    );

    await expect(service.authenticate("tk_secret")).resolves.toEqual(owner);
    expect(repository.findActiveByHash).toHaveBeenCalledWith(
      createHash("sha256").update("tk_secret").digest("hex"),
    );
    expect(repository.markUsed).toHaveBeenCalledWith("key-1", expect.any(Date));
  });

  it("Revoked key", async () => {
    const repository = {
      findActiveByHash: jest.fn().mockResolvedValue(null),
      markUsed: jest.fn(),
    };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      {} as UsersService,
    );

    await expect(service.authenticate("tk_revoked")).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
      status: 401,
    });
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it("Deleted key owner is unauthorized", async () => {
    const repository = {
      findActiveByHash: jest
        .fn()
        .mockResolvedValue({ id: "key-1", userId: "deleted-user" }),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    const users = { findById: jest.fn().mockResolvedValue(null) };
    const service = new ApiKeysService(
      repository as unknown as ApiKeysRepository,
      users as unknown as UsersService,
    );

    await expect(service.authenticate("tk_orphaned")).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
      status: 401,
    });
  });
});
