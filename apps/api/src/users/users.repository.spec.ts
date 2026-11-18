import { DataSource } from "typeorm";
import {
  createMySqlTestDatabase,
  dropMySqlTestDatabase,
} from "../../test/mysql-test-database";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import { DuplicateEmailError } from "./duplicate-email.error";

describe("User registration", () => {
  let dataSource: DataSource;
  let repository: UsersRepository;

  beforeEach(async () => {
    dataSource = await createMySqlTestDatabase();
    repository = new UsersRepository(dataSource.getRepository(User));
  });

  afterEach(async () => {
    const database = dataSource.options.database as string;
    await dataSource.destroy();
    await dropMySqlTestDatabase(database);
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
    await dataSource.getRepository(User).save({
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
