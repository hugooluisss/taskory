import { AuthGuard } from "./auth.guard";
import { JwtOnly } from "../jwt-only.decorator";
import { TokenAuthService } from "../token-auth.service";
import { Reflector } from "@nestjs/core";

describe("JWT-only authentication", () => {
  it("Reject API keys and OAuth tokens, and accept a JWT", async () => {
    class TestController {
      endpoint() {}
    }
    const handler = TestController.prototype.endpoint;
    JwtOnly()(
      TestController.prototype,
      "endpoint",
      Object.getOwnPropertyDescriptor(TestController.prototype, "endpoint")!,
    );
    const resolver = new Reflector();
    const auth = {
      authenticate: jest.fn().mockResolvedValue({ id: "user-1" }),
    };
    const guard = new AuthGuard(
      auth as unknown as TokenAuthService,
      resolver as never,
    );
    const context = (token: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
        }),
        getHandler: () => handler,
        getClass: () => TestController,
      }) as never;
    await expect(guard.canActivate(context("tk_key"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(guard.canActivate(context("to_oauth"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(guard.canActivate(context("jwt"))).resolves.toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith("jwt");
  });

  it("Accept an OAuth token on a normal protected endpoint", async () => {
    const auth = {
      authenticate: jest.fn().mockResolvedValue({ id: "user-1" }),
    };
    const guard = new AuthGuard(
      auth as unknown as TokenAuthService,
      new Reflector(),
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: "Bearer to_valid" } }),
      }),
      getHandler: () => function endpoint() {},
      getClass: () => class Controller {},
    } as never;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith("to_valid");
  });
});
