import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { DataSource, IsNull, Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { ApiKey } from "./entities/api-key.entity";
import { ApiKeysRepository } from "./api-keys.repository";

describe("API key authentication", () => {
  let dataSource: DataSource;
  let repository: ApiKeysRepository;
  let databasePath: string;
  let ownerId: string;
  let otherId: string;
  let keys: Repository<ApiKey>;

  beforeEach(async () => {
    databasePath = join(tmpdir(), `taskory-keys-${randomUUID()}.sqlite`);
    dataSource = await new DataSource({
      type: "better-sqlite3",
      database: databasePath,
      entities: [User, ApiKey],
      synchronize: true,
    }).initialize();
    const users = dataSource.getRepository(User);
    const owner = await users.save({
      email: "owner@example.com",
      name: "Owner",
      passwordHash: "hash",
    });
    const other = await users.save({
      email: "other@example.com",
      name: "Other",
      passwordHash: "hash",
    });
    ownerId = owner.id;
    otherId = other.id;
    keys = dataSource.getRepository(ApiKey);
    repository = new ApiKeysRepository(
      dataSource.getRepository(ApiKey),
      dataSource,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
    await unlink(databasePath).catch(() => undefined);
  });

  it("Request with a valid key finds active hashes only", async () => {
    await keys.save(
      keys.create({
        userId: ownerId,
        name: "Active",
        prefix: "tk_a",
        keyHash: "active-hash",
      }),
    );
    await keys.save(
      keys.create({
        userId: ownerId,
        name: "Revoked",
        prefix: "tk_r",
        keyHash: "revoked-hash",
      }),
    );
    await keys.update({ keyHash: "revoked-hash" }, { revokedAt: new Date() });

    await expect(
      repository.findActiveByHash("active-hash"),
    ).resolves.toMatchObject({ keyHash: "active-hash" });
    await expect(
      repository.findActiveByHash("revoked-hash"),
    ).resolves.toBeNull();
  });

  it("Another user's key cannot be revoked by another owner", async () => {
    const key = await keys.save(
      keys.create({
        userId: ownerId,
        name: "Owned",
        prefix: "tk_o",
        keyHash: "owner-hash",
      }),
    );

    await expect(repository.revoke(otherId, key.id, new Date())).resolves.toBe(
      false,
    );
    await expect(repository.revoke(ownerId, key.id, new Date())).resolves.toBe(
      true,
    );
  });

  it("Limit reached counts only active keys", async () => {
    await keys.save(
      keys.create({
        userId: ownerId,
        name: "Active",
        prefix: "tk_a",
        keyHash: "count-a",
      }),
    );
    await keys.save(
      keys.create({
        userId: ownerId,
        name: "Revoked",
        prefix: "tk_r",
        keyHash: "count-r",
        revokedAt: new Date(),
      }),
    );

    await expect(
      repository.createIfBelowLimit(
        { userId: ownerId, name: "Next", prefix: "tk_n", keyHash: "count-n" },
        2,
      ),
    ).resolves.toMatchObject({ userId: ownerId });
    await expect(
      repository.createIfBelowLimit(
        { userId: otherId, name: "Other", prefix: "tk_o", keyHash: "count-o" },
        1,
      ),
    ).resolves.toMatchObject({ userId: otherId });
  });

  it("Concurrent create attempts allow exactly the remaining slots", async () => {
    const attempts = Array.from({ length: 25 }, (_, index) =>
      repository.createIfBelowLimit(
        {
          userId: ownerId,
          name: `Concurrent ${index}`,
          prefix: `tk_${index}`,
          keyHash: `parallel-hash-${index}`,
        },
        20,
      ),
    );

    const results = await Promise.all(attempts);

    expect(results.filter(Boolean)).toHaveLength(20);
    expect(results.filter((result) => result === null)).toHaveLength(5);
    await expect(
      keys.count({ where: { userId: ownerId, revokedAt: IsNull() } }),
    ).resolves.toBe(20);
  });
});
