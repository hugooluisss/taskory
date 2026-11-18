import { AuthUser } from "../common/auth/auth-user";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ListActivitiesDto } from "./dto/list-activities.dto";

describe("Activity response serialization", () => {
  const activity = { id: "a1", userId: "u1", title: "Work", projects: [] };
  const service = {
    create: jest.fn().mockResolvedValue(activity),
    list: jest
      .fn()
      .mockResolvedValue({ items: [activity], total: 1, page: 1, limit: 50 }),
  };
  const controller = new ActivitiesController(
    service as unknown as ActivitiesService,
  );
  const user = { id: "u1" } as AuthUser;

  it("omits the owner id from a created activity", async () => {
    await expect(
      controller.create(user, {
        date: "2026-11-17",
        title: "Work",
      } as CreateActivityDto),
    ).resolves.toEqual({ id: "a1", title: "Work", projects: [] });
  });

  it("omits the owner id from listed activities", async () => {
    await expect(
      controller.list(user, {} as ListActivitiesDto),
    ).resolves.toEqual({
      items: [{ id: "a1", title: "Work", projects: [] }],
      total: 1,
      page: 1,
      limit: 50,
    });
  });
});
