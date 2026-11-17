import { HealthService } from "./health.service";

describe("Health check", () => {
  it("Service up", () => {
    expect(new HealthService().status()).toEqual({ status: "ok" });
  });
});
