import { describe, expect, it, vi } from "vitest";
import { ActivityToolsService } from "./activity-tools.service.js";

describe("User-local default date", () => {
  it("Date near midnight", async () => {
    const createActivity = vi.fn().mockResolvedValue({ id: "1" });
    const service = new ActivityToolsService(
      { createActivity } as never,
      () => new Date("2026-11-17T23:30:00.000Z"),
    );
    await service.log("token", { title: "Work", timezone: "Asia/Tokyo" });
    await service.log("token", {
      title: "Work",
      timezone: "America/Mexico_City",
    });
    expect(createActivity.mock.calls.map((call) => call[1])).toEqual([
      { title: "Work", date: "2026-11-18" },
      { title: "Work", date: "2026-11-17" },
    ]);
  });
});
