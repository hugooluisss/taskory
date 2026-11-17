import { isCalendarDate } from "./is-calendar-date";

describe("Calendar date predicate", () => {
  it("validates leap years and rejects invalid calendar dates", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("0000-00-00")).toBe(false);
  });
});
