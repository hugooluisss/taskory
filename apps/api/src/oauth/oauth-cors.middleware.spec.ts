import { OAuthCorsMiddleware } from "./oauth-cors.middleware";

describe("OAuth CORS routes", () => {
  it("Answers allowed preflight and skips API routes", () => {
    const middleware = new OAuthCorsMiddleware();
    const headers: Record<string, string> = {};
    const response = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      status: jest.fn(() => ({ end: jest.fn() })),
    };
    const next = jest.fn();
    middleware.use(
      { path: "/oauth/token", method: "OPTIONS" } as never,
      response as never,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(204);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    middleware.use(
      { path: "/api/v1/activities", method: "GET" } as never,
      response as never,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});
