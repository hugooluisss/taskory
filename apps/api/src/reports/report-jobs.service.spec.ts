import { ReportJob } from "./entities/report-job.entity";
import { ReportJobsRepository } from "./report-jobs.repository";
import { ReportMemoryRepository } from "./report-memory.repository";
import { ReportJobsService } from "./report-jobs.service";
import { ActiveReportExistsError } from "./errors/active-report-exists.error";

describe("Report job lifecycle", () => {
  let repository: jest.Mocked<
    Pick<
      ReportJobsRepository,
      | "ensureActiveJobIndex"
      | "markRunningInterrupted"
      | "findQueued"
      | "findRunning"
      | "findActiveForUser"
      | "create"
      | "find"
      | "update"
      | "retry"
      | "remove"
      | "purgeExpired"
    >
  >;
  let memory: jest.Mocked<Pick<ReportMemoryRepository, "list" | "save">>;
  let service: ReportJobsService;
  const job = {
    id: "job-id",
    userId: "user-id",
    status: "queued",
    params: {},
    activityIds: ["a"],
    chunkSize: 100,
    progressDone: 0,
    progressTotal: 1,
    finishedAt: null,
  } as ReportJob;
  const params = {
    from: "2026-01-01",
    to: "2026-01-31",
    language: "en" as const,
    style: "summary" as const,
  };

  beforeEach(() => {
    repository = {
      markRunningInterrupted: jest.fn().mockResolvedValue(undefined),
      ensureActiveJobIndex: jest.fn().mockResolvedValue(undefined),
      findQueued: jest.fn().mockResolvedValue([]),
      findRunning: jest.fn().mockResolvedValue([]),
      findActiveForUser: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(job),
      find: jest.fn().mockResolvedValue(job),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      retry: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(true),
      purgeExpired: jest.fn().mockResolvedValue([]),
    };
    memory = {
      list: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReportJobsService(repository as never, memory as never);
  });

  it("Enqueue calculates chunk progress", async () => {
    await service.enqueue("user-id", params, ["a", "b", "c"], 2);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ progressTotal: 2, status: "queued" }),
    );
  });

  it("Maps an active unique-index conflict to REPORT_IN_PROGRESS", async () => {
    repository.create.mockRejectedValue(new ActiveReportExistsError());
    repository.findActiveForUser.mockResolvedValue(job);
    await expect(
      service.enqueue("user-id", params, ["a"], 100),
    ).rejects.toMatchObject({
      response: { code: "REPORT_IN_PROGRESS", id: "job-id" },
    });
  });

  it("Propagates non-unique enqueue failures", async () => {
    const failure = new Error("database unavailable");
    repository.create.mockRejectedValue(failure);
    await expect(service.enqueue("user-id", params, ["a"], 100)).rejects.toBe(
      failure,
    );
  });

  it("Startup recovery interrupts running jobs only", async () => {
    await service.recover();
    expect(repository.markRunningInterrupted).toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it("Only failed reports can be retried", async () => {
    await expect(service.retry("user-id", "job-id")).rejects.toMatchObject({
      response: { code: "REPORT_NOT_RETRYABLE" },
    });
    repository.find.mockResolvedValue({ ...job, status: "failed" });
    await service.retry("user-id", "job-id");
    expect(repository.retry).toHaveBeenCalledWith("user-id", "job-id");
  });

  it("Failed report cannot retry while another report is active", async () => {
    repository.find.mockResolvedValue({ ...job, status: "failed" });
    repository.findActiveForUser.mockResolvedValue(job);
    repository.retry.mockRejectedValue(new ActiveReportExistsError());
    await expect(service.retry("user-id", "job-id")).rejects.toMatchObject({
      response: { code: "REPORT_IN_PROGRESS", id: "job-id" },
    });
  });

  it("Maps a retry lost at the failed status boundary to NOT_RETRYABLE", async () => {
    repository.find
      .mockResolvedValueOnce({ ...job, status: "failed" })
      .mockResolvedValueOnce(job);
    repository.retry.mockResolvedValue(false);
    await expect(service.retry("user-id", "job-id")).rejects.toMatchObject({
      response: { code: "REPORT_NOT_RETRYABLE" },
    });
  });

  it("Missing and foreign reports are not found", async () => {
    repository.find.mockResolvedValue(null);
    await expect(service.get("other-user", "job-id")).rejects.toMatchObject({
      response: { code: "NOT_FOUND" },
    });
  });

  it("Enqueue works before the runner registers", async () => {
    service = new ReportJobsService(repository as never, memory as never);
    await service.enqueue("user-id", params, ["a"], 100);
    expect(repository.create).toHaveBeenCalled();
  });

  it("Delete removes the job and cascades memory", async () => {
    await service.delete("user-id", "job-id");
    expect(repository.remove).toHaveBeenCalledWith("user-id", "job-id");
  });

  it("Retention purges expired jobs and memory", async () => {
    repository.purgeExpired.mockResolvedValue([
      { id: "expired", userId: "user-id" },
    ]);
    await service.purgeExpired();
    expect(repository.remove).toHaveBeenCalledWith("user-id", "expired");
  });

  it("Passes memory and progress operations through their repositories", async () => {
    const row = { reportId: "job-id", userId: "user-id" } as never;
    await service.listQueued();
    await service.listMemory("user-id", "job-id");
    await service.saveMemory("user-id", row);
    await service.markRunning(job);
    await service.update("user-id", "job-id", { progressDone: 1 });
    expect(memory.list).toHaveBeenCalledWith("user-id", "job-id");
    expect(memory.save).toHaveBeenCalledWith("user-id", row);
    expect(repository.update).toHaveBeenCalledTimes(2);
  });
});
