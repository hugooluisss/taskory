import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

describe("Project management", () => {
  it("Trims a new project name", async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: "p1", name: "Alpha" }),
    } as unknown as ProjectsRepository;
    await expect(
      new ProjectsService(repository).create("u1", " Alpha "),
    ).resolves.toMatchObject({ name: "Alpha" });
    expect(repository.create).toHaveBeenCalledWith("u1", " Alpha ");
  });

  it("Rejects blank and oversized names", async () => {
    const repository = { create: jest.fn() } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    for (const name of ["  ", "x".repeat(101)]) {
      await expect(service.create("u1", name)).rejects.toMatchObject({
        response: { code: "VALIDATION_ERROR" },
      });
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("Maps duplicate names to conflict and preserves other errors", async () => {
    const duplicate = { code: "ER_DUP_ENTRY" };
    const failure = new Error("database unavailable");
    const repository = {
      create: jest
        .fn()
        .mockRejectedValueOnce(duplicate)
        .mockRejectedValueOnce(failure),
    } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    await expect(service.create("u1", "Alpha")).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.create("u1", "Beta")).rejects.toBe(failure);
  });

  it("Lists and finds owned projects", async () => {
    const project = { id: "p1", name: "Alpha" };
    const repository = {
      list: jest.fn().mockResolvedValue([project]),
      find: jest.fn().mockResolvedValue(project),
    } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    await expect(service.list("u1")).resolves.toEqual([project]);
    await expect(service.get("u1", "p1")).resolves.toBe(project);
  });

  it("Returns not found for projects outside the user scope", async () => {
    const repository = {
      find: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    await expect(service.get("u1", "p2")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.getMany("u1", ["p2"])).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.getMany("u1", [])).resolves.toEqual([]);
  });

  it("Returns the requested owned project", async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: "p1" }]),
    } as unknown as ProjectsRepository;
    await expect(
      new ProjectsService(repository).getMany("u1", ["p1"]),
    ).resolves.toEqual([{ id: "p1" }]);
  });

  it("Renames and archives an owned project", async () => {
    const project = { id: "p1", name: "Alpha", archived: false };
    const repository = {
      update: jest.fn().mockResolvedValue({
        ...project,
        name: "Renamed",
        archived: true,
      }),
    } as unknown as ProjectsRepository;
    await expect(
      new ProjectsService(repository).update("u1", "p1", {
        name: " Renamed ",
        archived: true,
      }),
    ).resolves.toMatchObject({ name: "Renamed", archived: true });
  });

  it("Rejects invalid rename, duplicate rename, and missing project", async () => {
    const duplicate = { code: "ER_DUP_ENTRY" };
    const repository = {
      update: jest.fn().mockRejectedValue(duplicate),
    } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    await expect(
      service.update("u1", "p1", { name: "  " }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.update("u1", "p1", { name: "Existing" }),
    ).rejects.toMatchObject({ status: 409 });

    const missing = new ProjectsService({
      update: jest.fn().mockResolvedValue(null),
    } as unknown as ProjectsRepository);
    await expect(
      missing.update("u1", "p2", { archived: true }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Deletes empty projects and refuses referenced projects", async () => {
    const repository = {
      delete: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce({
          driverError: { code: "ER_ROW_IS_REFERENCED_2" },
        }),
    } as unknown as ProjectsRepository;
    const service = new ProjectsService(repository);
    await expect(service.delete("u1", "p1")).resolves.toBeUndefined();
    await expect(service.delete("u1", "p2")).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.delete("u1", "p3")).rejects.toMatchObject({
      status: 409,
    });
  });
});
