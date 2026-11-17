import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

describe("User registration", () => {
  it("Successful registration normalizes email and detects duplicates", async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: "u1" }),
      findByEmail: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: "u1" }),
      findByEmailWithHash: jest
        .fn()
        .mockResolvedValue({ id: "u1", passwordHash: "hash" }),
      create: jest.fn().mockResolvedValue({ id: "u1" }),
      update: jest.fn().mockResolvedValue({ id: "u1", name: "Changed" }),
    };
    const service = new UsersService(repository as unknown as UsersRepository);

    await expect(
      service.findByEmailWithHash(" Person@Example.com "),
    ).resolves.toMatchObject({ passwordHash: "hash" });
    expect(repository.findByEmailWithHash).toHaveBeenCalledWith(
      "person@example.com",
    );
    await expect(
      service.register(" Person@Example.com ", "Person", "hash"),
    ).resolves.toMatchObject({ id: "u1" });
    expect(repository.create).toHaveBeenCalledWith(
      "person@example.com",
      "Person",
      "hash",
    );
    await expect(
      service.register("person@example.com", "Person", "hash"),
    ).rejects.toMatchObject({ name: "DuplicateEmailError" });
    await expect(
      service.update("u1", { name: "Changed" }),
    ).resolves.toMatchObject({ name: "Changed" });
    expect(repository.findByEmail).toHaveBeenCalledWith("person@example.com");
    expect(repository.update).toHaveBeenCalledWith("u1", { name: "Changed" });
  });
});
