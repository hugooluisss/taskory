import { SharedReportsRepository } from "./shared-reports.repository";

describe("Shared report repository", () => {
  it("Looks up a report by its stored share hash", async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const reports = new SharedReportsRepository(
      { findOne } as never,
      {} as never,
    );
    await reports.findByHash("hash");
    expect(findOne).toHaveBeenCalledWith({ where: { shareTokenHash: "hash" } });
  });

  it("Loads only snapshot activities for the report owner", async () => {
    const getMany = jest.fn().mockResolvedValue([]);
    const query = {
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getMany,
    };
    query.leftJoinAndSelect.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    const createQueryBuilder = jest.fn().mockReturnValue(query);
    const reports = new SharedReportsRepository(
      {} as never,
      { createQueryBuilder } as never,
    );
    await reports.activitiesFor({
      userId: "owner",
      activityIds: ["activity"],
    } as never);
    expect(createQueryBuilder).toHaveBeenCalledWith("activity");
    expect(query.where).toHaveBeenCalledWith("activity.userId = :userId", {
      userId: "owner",
    });
    expect(query.andWhere).toHaveBeenCalledWith("activity.id IN (:...ids)", {
      ids: ["activity"],
    });
  });

  it("Skips the activity query for an empty snapshot", async () => {
    const createQueryBuilder = jest.fn();
    const reports = new SharedReportsRepository(
      {} as never,
      { createQueryBuilder } as never,
    );
    await expect(
      reports.activitiesFor({ activityIds: [] } as never),
    ).resolves.toEqual([]);
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});
