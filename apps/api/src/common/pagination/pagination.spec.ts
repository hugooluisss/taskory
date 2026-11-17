import { pagination } from "./pagination";

describe("Pagination envelope", () => {
  it("Limit above cap", () => {
    expect(pagination()).toEqual({ page: 1, limit: 50, skip: 0 });
    expect(pagination("3", "1000")).toEqual({ page: 3, limit: 200, skip: 400 });
    expect(pagination("0", "-4")).toEqual({ page: 1, limit: 50, skip: 0 });
  });
});
