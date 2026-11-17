import { HttpException } from "@nestjs/common";
import { ErrorsFilter } from "./errors.filter";

describe("ErrorsFilter", () => {
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
