import { validateConfig } from "./config";

describe("bootstrap configuration", () => {
  it("requires JWT_SECRET before starting the application", () => {
    const previous = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => validateConfig()).toThrow("JWT_SECRET is required");

    process.env.JWT_SECRET = previous;
  });
});
