import { Logger } from "@nestjs/common";
import { OAuthMaintenanceService } from "./oauth-maintenance.service";

describe("OAuth retention maintenance", () => {
  it("Purge on startup, schedule daily and clear the timer on shutdown", async () => {
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    let callback: (() => void) | undefined;
    const interval = jest.spyOn(global, "setInterval").mockImplementation(((
      fn: () => void,
    ) => {
      callback = fn;
      return timer;
    }) as typeof setInterval);
    const clear = jest
      .spyOn(global, "clearInterval")
      .mockImplementation(() => undefined);
    const tokens = { purgeExpired: jest.fn().mockResolvedValue({}) };
    const service = new OAuthMaintenanceService(
      tokens as never,
      () => new Date("2026-01-01T00:00:00Z"),
    );
    await service.onApplicationBootstrap();
    expect(tokens.purgeExpired).toHaveBeenCalledTimes(1);
    expect(tokens.purgeExpired.mock.calls[0]).toHaveLength(3);
    expect(interval).toHaveBeenCalledWith(
      expect.any(Function),
      24 * 60 * 60 * 1000,
    );
    expect(timer.unref).toHaveBeenCalled();
    callback?.();
    await Promise.resolve();
    expect(tokens.purgeExpired).toHaveBeenCalledTimes(2);
    service.onApplicationShutdown();
    expect(clear).toHaveBeenCalledWith(timer);
    interval.mockRestore();
    clear.mockRestore();
  });

  it("Log purge failures without rejecting application startup", async () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const interval = jest.spyOn(global, "setInterval").mockReturnValue(timer);
    const service = new OAuthMaintenanceService(
      {
        purgeExpired: jest.fn().mockRejectedValue(new Error("database")),
      } as never,
      () => new Date(),
    );
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    service.onApplicationShutdown();
    interval.mockRestore();
    log.mockRestore();
  });

  it("Allow shutdown before bootstrap without clearing an unset timer", () => {
    const clear = jest.spyOn(global, "clearInterval");
    const service = new OAuthMaintenanceService(
      { purgeExpired: jest.fn() } as never,
      () => new Date(),
    );
    service.onApplicationShutdown();
    expect(clear).not.toHaveBeenCalled();
    clear.mockRestore();
  });
});
