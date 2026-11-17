import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import { DuplicateEmailError } from "./duplicate-email.error";

describe("User registration", () => {
  let dataSource: DataSource;
  let repository: UsersRepository;
  let databasePath: string;

  beforeEach(async () => {
    databasePath = join(tmpdir(), `taskory-users-${randomUUID()}.sqlite`);
    dataSource = await new DataSource({
      type: "better-sqlite3",
      database: databasePath,
      entities: [User],
      synchronize: true,
    }).initialize();
    repository = new UsersRepository(dataSource.getRepository(User));
  });

  afterEach(async () => {
    await dataSource.destroy();
    await unlink(databasePath).catch(() => undefined);
  });

  it("Duplicate email lookup finds existing user", async () => {
    await dataSource
      .getRepository(User)
      .save({ email: "find@example.com", name: "Find", passwordHash: "hash" });
    await expect(
      repository.findByEmail("find@example.com"),
    ).resolves.toMatchObject({ email: "find@example.com" });
  });

  it("Password security loads the hash only for authentication", async () => {
    await dataSource
      .getRepository(User)
      .save({
        email: "hash@example.com",
        name: "Hash",
        passwordHash: "secret-hash",
      });
    await expect(
      repository.findByEmailWithHash("hash@example.com"),
    ).resolves.toMatchObject({ passwordHash: "secret-hash" });
  });

  it("create translates a duplicate email constraint", async () => {
    await repository.create("duplicate@example.com", "First", "hash-1");
    await expect(
      repository.create("duplicate@example.com", "Second", "hash-2"),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });
});
