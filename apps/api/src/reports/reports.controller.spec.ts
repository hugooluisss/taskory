import { ReportsController } from "./reports.controller";

describe("List styles", () => {
  it("returns the authenticated user's style data", async () => {
    const result = { styles: [], customPrompt: "Saved" };
    const service = { listStyles: jest.fn().mockResolvedValue(result) };
    const controller = new ReportsController(service as never);
    await expect(controller.styles({ id: "user" } as never)).resolves.toBe(
      result,
    );
    expect(service.listStyles).toHaveBeenCalledWith("user");
  });
});
