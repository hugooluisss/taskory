import { ApiException } from "../common/errors/api-exception";
import { ConnectedAppsService } from "./connected-apps.service";

describe("Connected apps", () => {
  it("List only the authenticated user's active applications", async () => {
    const rows = new Map([
      [
        "one",
        [
          {
            id: "app-1",
            client: { name: "One" },
            createdAt: new Date(),
            lastUsedAt: null,
          },
        ],
      ],
      [
        "two",
        [
          {
            id: "app-2",
            client: { name: "Two" },
            createdAt: new Date(),
            lastUsedAt: null,
          },
        ],
      ],
    ]);
    const repository = {
      listActive: jest.fn((userId: string) =>
        Promise.resolve(rows.get(userId) ?? []),
      ),
    };
    const service = new ConnectedAppsService(
      repository as never,
      () => new Date(),
    );
    await expect(service.list("one")).resolves.toMatchObject([
      { id: "app-1", clientName: "One" },
    ]);
    expect(repository.listActive).toHaveBeenCalledWith("one");
  });

  it("Return 404 when revoking another user's authorization", async () => {
    const repository = {
      revokeAuthorization: jest.fn().mockResolvedValue(false),
    };
    const service = new ConnectedAppsService(
      repository as never,
      () => new Date(),
    );
    await expect(service.revoke("other", "foreign-id")).rejects.toBeInstanceOf(
      ApiException,
    );
    await expect(service.revoke("other", "foreign-id")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("Revoke an authorization owned by the user", async () => {
    const repository = {
      revokeAuthorization: jest.fn().mockResolvedValue(true),
    };
    const now = new Date("2026-01-01T00:00:00Z");
    const service = new ConnectedAppsService(repository as never, () => now);
    await expect(service.revoke("owner", "app-1")).resolves.toBeUndefined();
    expect(repository.revokeAuthorization).toHaveBeenCalledWith(
      "owner",
      "app-1",
      now,
    );
  });
});
