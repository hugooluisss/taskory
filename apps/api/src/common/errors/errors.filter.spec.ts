import { HttpException } from "@nestjs/common";
import { ErrorsFilter } from "./errors.filter";
import { OAuthError } from "../../oauth/oauth-error";

describe("ErrorsFilter", () => {
  it("Maps OAuth errors to RFC 6749 JSON", () => {
    const json = jest.fn();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(() => ({ json })),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ path: "/oauth/token", headers: {} }),
        getResponse: () => response,
      }),
    };
    new ErrorsFilter().catch(
      new OAuthError("invalid_grant", "Bad grant", 400),
      host as never,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: "invalid_grant",
      error_description: "Bad grant",
    });
  });

  it("Hides unexpected OAuth errors and sets no-store headers", () => {
    const json = jest.fn();
    const setHeader = jest.fn();
    const response = { setHeader, status: jest.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ path: "/oauth/token", headers: {} }),
        getResponse: () => response,
      }),
    };
    new ErrorsFilter().catch(new Error("private details"), host as never);
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "server_error" });
    expect(JSON.stringify(json.mock.calls)).not.toContain("private details");
  });

  it("Preserves the localized message and whitelists only the active report id", () => {
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };
    const request = { headers: { "accept-language": "en" } };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    new ErrorsFilter().catch(
      new HttpException(
        {
          code: "REPORT_IN_PROGRESS",
          id: "active",
          message: "Injected",
          extra: "secret",
        },
        409,
      ),
      host as never,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: "REPORT_IN_PROGRESS",
      message: expect.any(String),
      id: "active",
    });
  });
});
