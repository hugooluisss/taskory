import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error.js";
import { TaskoryApiClient } from "./taskory-api.client.js";

describe("Token forwarding without shared credentials", () => {
  it("Invalid token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "missing",
        }),
        { status: 404 },
      ),
    );
    const client = new TaskoryApiClient("http://localhost/api/v1", fetcher);
    const error = await client
      .listActivities("user-token", {})
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "missing",
    });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer user-token",
    });
  });

  it("Token validation on every request", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("{}"));
    const client = new TaskoryApiClient("https://api.test", fetcher);
    await client.validateToken("token");
    await client.validateToken("token");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("Upstream failures are distinguishable", () => {
  it("Maps network failures to UPSTREAM_UNAVAILABLE", async () => {
    const client = new TaskoryApiClient("https://api.test", async () => {
      throw new Error("private");
    });
    await expect(client.validateToken("token")).rejects.toMatchObject({
      name: "UpstreamUnavailable",
    });
  });

  it("Maps API 5xx responses to UPSTREAM_UNAVAILABLE", async () => {
    const client = new TaskoryApiClient(
      "https://api.test",
      async () => new Response("secret", { status: 503 }),
    );
    await expect(client.validateToken("token")).rejects.toMatchObject({
      name: "UpstreamUnavailable",
    });
  });

  it("Maps timeouts to UPSTREAM_UNAVAILABLE", async () => {
    const fetcher = async () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    const client = new TaskoryApiClient("https://api.test", fetcher);
    await expect(client.validateToken("token")).rejects.toMatchObject({
      name: "UpstreamUnavailable",
    });
  });
});
