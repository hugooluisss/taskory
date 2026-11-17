import { Logger } from "@nestjs/common";
import { ReportGenerationError } from "./ports/report-generation-error";
import { Activity } from "../activities/entities/activity.entity";
import { ReportJob } from "./entities/report-job.entity";
import { ReportMemory } from "./entities/report-memory.entity";
import { ReportJobRunner } from "./report-job.runner";
import { ReportGeneratorPort } from "./ports/report-generator.port";

describe("Chunked generation for large reports", () => {
  describe("Final report from memory", () => {
    it("Completion", async () => {
      const context = createContext(jobWithCount(250));
      context.runner.enqueue("report", "owner");
      await context.runner.awaitIdle();
      expect(
        context.generator.evaluateChunk.mock.calls.map(
          ([input]) => input.activities.length,
        ),
      ).toEqual([100, 100, 50]);
      expect(
        context.generator.evaluateChunk.mock.calls[0][0].activities[0].id,
      ).toBe("activity-0");
      expect(
        context.generator.evaluateChunk.mock.calls[2][0].activities[0].id,
      ).toBe("activity-200");
      expect(context.generator.writeFinal.mock.calls[0][0].memory).toHaveLength(
        3,
      );
    });
  });

  it("250 activities", async () => {
    const context = createContext(jobWithCount(250));
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(
      context.generator.evaluateChunk.mock.calls.map(
        ([input]) => input.activities.length,
      ),
    ).toEqual([100, 100, 50]);
    expect(
      context.generator.evaluateChunk.mock.calls[0][0].activities[0].id,
    ).toBe("activity-0");
    expect(
      context.generator.evaluateChunk.mock.calls[2][0].activities[0].id,
    ).toBe("activity-200");
  });

  it("Memory accumulates", async () => {
    const context = createContext(jobWithCount(100));
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.lifecycle.saveMemory).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        chunkIndex: 0,
        activityCount: 100,
        byProject: { none: 100 },
      }),
    );
    expect(context.lifecycle.update).toHaveBeenCalledWith("owner", "report", {
      progressDone: 1,
    });
  });

  it("Resume", async () => {
    const context = createContext(jobWithCount(700));
    context.memory.set(
      "report",
      Array.from({ length: 4 }, (_, index) => memoryRow("report", index)),
    );
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(3);
    expect(context.generator.writeFinal.mock.calls[0][0].memory).toHaveLength(
      7,
    );
    expect(
      context.generator.writeFinal.mock.calls[0][0].totals.byProject,
    ).toEqual({ none: 700 });
    expect(context.activities.findReportChunk).toHaveBeenCalledTimes(3);
  });

  it("Retries a failed report using its stored memory", async () => {
    const context = createContext(jobWithCount(200));
    context.generator.evaluateChunk.mockRejectedValueOnce(
      new ReportGenerationError("LLM_UNAVAILABLE"),
    );
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    context.jobMap.set("report", {
      ...context.jobMap.get("report")!,
      status: "queued",
    });
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(3);
    expect(context.generator.writeFinal.mock.calls[0][0].memory).toHaveLength(
      2,
    );
  });

  it("Maps invalid provider output to the exact failing chunk", async () => {
    const context = createContext(jobWithCount(300));
    context.generator.evaluateChunk
      .mockResolvedValueOnce({
        summary: "first",
        highlights: [],
        provider: "fake",
        model: "fake",
      })
      .mockRejectedValueOnce(new ReportGenerationError("INVALID_LLM_OUTPUT"));
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.lifecycle.update).toHaveBeenCalledWith(
      "owner",
      "report",
      expect.objectContaining({
        errorCode: "INVALID_LLM_OUTPUT",
        errorChunk: 1,
      }),
    );
  });

  it("Maps provider failure to LLM_UNAVAILABLE", async () => {
    const context = createContext(jobWithCount(100));
    context.generator.evaluateChunk.mockRejectedValueOnce(
      new ReportGenerationError("LLM_UNAVAILABLE"),
    );
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.lifecycle.update).toHaveBeenCalledWith(
      "owner",
      "report",
      expect.objectContaining({
        errorCode: "LLM_UNAVAILABLE",
        errorChunk: 0,
      }),
    );
  });

  it("Maps an unknown failure to INTERNAL_ERROR", async () => {
    const context = createContext(jobWithCount(100));
    context.generator.evaluateChunk.mockRejectedValueOnce(
      new Error("unexpected"),
    );
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.lifecycle.update).toHaveBeenCalledWith(
      "owner",
      "report",
      expect.objectContaining({
        errorCode: "INTERNAL_ERROR",
        errorChunk: 0,
      }),
    );
  });

  it("Uses a null chunk index when final writing fails", async () => {
    const context = createContext(jobWithCount(100));
    context.generator.writeFinal.mockRejectedValueOnce(
      new ReportGenerationError("LLM_UNAVAILABLE"),
    );
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.lifecycle.update).toHaveBeenCalledWith(
      "owner",
      "report",
      expect.objectContaining({
        errorCode: "LLM_UNAVAILABLE",
        errorChunk: null,
      }),
    );
  });

  it("Stops before the next provider call after cancellation", async () => {
    const context = createContext(jobWithCount(200));
    const started = deferred<void>();
    const evaluation = deferred<{
      summary: string;
      highlights: [];
      provider: string;
      model: string;
    }>();
    context.generator.evaluateChunk.mockImplementationOnce(() => {
      started.resolve();
      return evaluation.promise;
    });
    context.runner.enqueue("report", "owner");
    await started.promise;
    context.runner.cancel("report");
    evaluation.resolve({
      summary: "one",
      highlights: [],
      provider: "fake",
      model: "fake",
    });
    await context.runner.awaitIdle();
    expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(1);
    expect(context.generator.writeFinal).not.toHaveBeenCalled();
  });

  it("Does not call the provider when every snapshot activity was deleted", async () => {
    const context = createContext(jobWithCount(100));
    context.activities.findReportChunk.mockResolvedValue([]);
    context.runner.enqueue("report", "owner");
    await context.runner.awaitIdle();
    expect(context.generator.evaluateChunk).not.toHaveBeenCalled();
    expect(context.lifecycle.saveMemory).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        activityCount: 0,
        summary: "",
        highlights: [],
      }),
    );
  });

  it("Limits globally to two running jobs and leaves the third queued", async () => {
    const context = createContext(jobWithCount(100));
    const jobs = ["first", "second", "third"];
    for (const [index, id] of jobs.entries()) {
      context.jobMap.set(id, {
        ...jobWithCount(100),
        id,
        userId: `owner-${index + 1}`,
      });
    }
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const thirdStarted = deferred<void>();
    const firstResult = deferred<{
      summary: string;
      highlights: [];
      provider: string;
      model: string;
    }>();
    const secondResult = deferred<{
      summary: string;
      highlights: [];
      provider: string;
      model: string;
    }>();
    context.generator.evaluateChunk
      .mockImplementationOnce(() => {
        firstStarted.resolve();
        return firstResult.promise;
      })
      .mockImplementationOnce(() => {
        secondStarted.resolve();
        return secondResult.promise;
      })
      .mockImplementationOnce(() => {
        thirdStarted.resolve();
        return Promise.resolve({
          summary: "third",
          highlights: [],
          provider: "fake",
          model: "fake",
        });
      });
    context.runner.enqueue("first", "owner-1");
    context.runner.enqueue("second", "owner-2");
    context.runner.enqueue("third", "owner-3");
    await Promise.all([firstStarted.promise, secondStarted.promise]);
    expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(2);
    firstResult.resolve({
      summary: "first",
      highlights: [],
      provider: "fake",
      model: "fake",
    });
    await thirdStarted.promise;
    secondResult.resolve({
      summary: "second",
      highlights: [],
      provider: "fake",
      model: "fake",
    });
    await context.runner.awaitIdle();
  });

  it("Cancelling a queued job removes it before provider work starts", async () => {
    const context = createContext(jobWithCount(100));
    context.jobMap.set("second", {
      ...jobWithCount(100),
      id: "second",
      userId: "owner-2",
    });
    context.jobMap.set("queued", {
      ...jobWithCount(100),
      id: "queued",
      userId: "owner-3",
    });
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const firstResult = deferred<{
      summary: string;
      highlights: [];
      provider: string;
      model: string;
    }>();
    const secondResult = deferred<{
      summary: string;
      highlights: [];
      provider: string;
      model: string;
    }>();
    context.generator.evaluateChunk
      .mockImplementationOnce(() => {
        firstStarted.resolve();
        return firstResult.promise;
      })
      .mockImplementationOnce(() => {
        secondStarted.resolve();
        return secondResult.promise;
      });
    context.runner.enqueue("report", "owner");
    context.runner.enqueue("second", "owner-2");
    context.runner.enqueue("queued", "owner-3");
    await Promise.all([firstStarted.promise, secondStarted.promise]);
    context.runner.cancel("queued");
    firstResult.resolve({
      summary: "first",
      highlights: [],
      provider: "fake",
      model: "fake",
    });
    secondResult.resolve({
      summary: "second",
      highlights: [],
      provider: "fake",
      model: "fake",
    });
    await context.runner.awaitIdle();
    expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(2);
  });

  describe("Delete a report", () => {
    it("Queued deletion before stale rediscovery", async () => {
      const context = createContext(jobWithCount(1));
      const snapshot = deferred<ReportJob[]>();
      context.lifecycle.listQueued.mockReturnValueOnce(snapshot.promise);
      const rediscovery = context.runner.resumeQueued();

      context.runner.cancel("report");
      context.jobMap.delete("report");
      context.runner.finishCancellation("report");
      snapshot.resolve([jobWithCount(1)]);
      await rediscovery;
      await context.runner.awaitIdle();

      expect(context.generator.evaluateChunk).not.toHaveBeenCalled();
    });

    it("Queued deletion after rediscovery", async () => {
      const context = createContext(jobWithCount(1));
      const first = withJob(context, "first");
      const second = withJob(context, "second");
      const firstStarted = deferred<void>();
      const secondStarted = deferred<void>();
      const firstResult = deferred<ChunkResult>();
      const secondResult = deferred<ChunkResult>();
      context.generator.evaluateChunk
        .mockImplementationOnce(() => {
          firstStarted.resolve();
          return firstResult.promise;
        })
        .mockImplementationOnce(() => {
          secondStarted.resolve();
          return secondResult.promise;
        });
      context.runner.enqueue(first.id, first.userId);
      context.runner.enqueue(second.id, second.userId);
      await Promise.all([firstStarted.promise, secondStarted.promise]);
      await context.runner.resumeQueued();

      context.runner.cancel("report");
      context.jobMap.delete("report");
      context.runner.finishCancellation("report");
      firstResult.resolve(chunkResult("first"));
      secondResult.resolve(chunkResult("second"));
      await context.runner.awaitIdle();

      expect(context.generator.evaluateChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe("Runner slot release", () => {
    it("Releases the slot when failed status persistence rejects", async () => {
      const context = createContext(
        withJobId(jobWithCount(1), "first", "user-1"),
      );
      const second = withJob(context, "second", "user-2");
      const third = withJob(context, "third", "user-3");
      const secondStarted = deferred<void>();
      const thirdStarted = deferred<void>();
      const secondResult = deferred<ChunkResult>();
      const update = context.lifecycle.update.getMockImplementation()!;
      context.lifecycle.update.mockImplementation((userId, id, values) => {
        if (id === "first" && values.status === "failed")
          return Promise.reject(new Error("disk full"));
        return update(userId, id, values);
      });
      context.generator.evaluateChunk
        .mockRejectedValueOnce(new ReportGenerationError("LLM_UNAVAILABLE"))
        .mockImplementationOnce(() => {
          secondStarted.resolve();
          return secondResult.promise;
        })
        .mockImplementationOnce(() => {
          thirdStarted.resolve();
          return Promise.resolve(chunkResult("third"));
        });
      const logger = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      context.runner.enqueue("first", "user-1");
      context.runner.enqueue(second.id, second.userId);
      context.runner.enqueue(third.id, third.userId);
      await Promise.all([secondStarted.promise, thirdStarted.promise]);
      expect(logger).toHaveBeenCalledWith(expect.stringContaining("first"));
      secondResult.resolve(chunkResult("second"));
      await context.runner.awaitIdle();
      logger.mockRestore();
    });

    it("Releases the slot when queued-job reload rejects", async () => {
      const context = createContext(
        withJobId(jobWithCount(1), "first", "user-1"),
      );
      const second = withJob(context, "second", "user-2");
      const third = withJob(context, "third", "user-3");
      const secondStarted = deferred<void>();
      const thirdStarted = deferred<void>();
      const secondResult = deferred<ChunkResult>();
      context.lifecycle.listQueued.mockRejectedValueOnce(
        new Error("database unavailable"),
      );
      context.generator.evaluateChunk
        .mockResolvedValueOnce(chunkResult("first"))
        .mockImplementationOnce(() => {
          secondStarted.resolve();
          return secondResult.promise;
        })
        .mockImplementationOnce(() => {
          thirdStarted.resolve();
          return Promise.resolve(chunkResult("third"));
        });
      const logger = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      context.runner.enqueue("first", "user-1");
      context.runner.enqueue(second.id, second.userId);
      context.runner.enqueue(third.id, third.userId);
      await Promise.all([secondStarted.promise, thirdStarted.promise]);
      expect(logger).toHaveBeenCalledWith(expect.stringContaining("first"));
      secondResult.resolve(chunkResult("second"));
      await context.runner.awaitIdle();
      logger.mockRestore();
    });
  });

  function withJob(
    context: ReturnType<typeof createContext>,
    id: string,
    userId = id,
  ): ReportJob {
    const job = withJobId(jobWithCount(1), id, userId);
    context.jobMap.set(id, job);
    return job;
  }

  function withJobId(job: ReportJob, id: string, userId: string): ReportJob {
    return { ...job, id, userId, activityIds: [`activity-${id}`] };
  }

  function createContext(initial: ReportJob) {
    const jobMap = new Map<string, ReportJob>([[initial.id, initial]]);
    const memory = new Map<string, ReportMemory[]>();
    const lifecycle = {
      queuedForDispatch: jest.fn(async (userId: string, id: string) => {
        const job = jobMap.get(id);
        return job?.userId === userId && job.status === "queued" ? job : null;
      }),
      markRunning: jest.fn(async (job: ReportJob) => {
        jobMap.set(job.id, { ...job, status: "running" });
      }),
      listMemory: jest.fn(async (_userId: string, id: string) => [
        ...(memory.get(id) ?? []),
      ]),
      saveMemory: jest.fn(async (_userId: string, row: ReportMemory) => {
        memory.set(row.reportId, [...(memory.get(row.reportId) ?? []), row]);
      }),
      update: jest.fn(
        async (_userId: string, _id: string, values: Partial<ReportJob>) => {
          const job = jobMap.get(_id);
          if (job) jobMap.set(_id, { ...job, ...values });
        },
      ),
      listQueued: jest.fn(async () =>
        [...jobMap.values()].filter((job) => job.status === "queued"),
      ),
    };
    const activities = {
      findReportChunk: jest.fn(async (_userId: string, ids: string[]) =>
        ids.map(activity),
      ),
    };
    const generator: {
      evaluateChunk: jest.Mock<
        ReturnType<ReportGeneratorPort["evaluateChunk"]>,
        Parameters<ReportGeneratorPort["evaluateChunk"]>
      >;
      writeFinal: jest.Mock<
        ReturnType<ReportGeneratorPort["writeFinal"]>,
        Parameters<ReportGeneratorPort["writeFinal"]>
      >;
    } = {
      evaluateChunk: jest.fn(
        async (
          _input: Parameters<ReportGeneratorPort["evaluateChunk"]>[0],
        ) => ({
          summary: "summary",
          highlights: [],
          provider: "fake",
          model: "fake",
        }),
      ),
      writeFinal: jest.fn(
        async (_input: Parameters<ReportGeneratorPort["writeFinal"]>[0]) => ({
          markdown: "# Report",
          provider: "fake",
          model: "fake",
        }),
      ),
    };
    const runner = new ReportJobRunner(
      lifecycle as never,
      activities as never,
      generator as never,
    );
    return { runner, lifecycle, activities, generator, memory, jobMap };
  }

  function jobWithCount(count: number): ReportJob {
    return {
      id: "report",
      userId: "owner",
      status: "queued",
      params: {
        from: "2026-01-01",
        to: "2026-01-31",
        language: "en",
        style: "summary",
      },
      activityIds: Array.from(
        { length: count },
        (_, index) => `activity-${index}`,
      ),
      chunkSize: 100,
      progressDone: 0,
      progressTotal: Math.ceil(count / 100),
      markdown: null,
      provider: null,
      model: null,
      errorCode: null,
      errorChunk: null,
      createdAt: new Date(),
      finishedAt: null,
    };
  }

  function memoryRow(reportId: string, chunkIndex: number): ReportMemory {
    return {
      reportId,
      userId: "owner",
      chunkIndex,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-01",
      activityCount: 100,
      summary: "summary",
      highlights: [],
      byProject: { none: 100 },
      byDay: { "2026-01-01": 100 },
    };
  }

  function activity(id: string): Activity {
    const index = Number(id.replace("activity-", ""));
    const day = String(1 + Math.floor(index / 100)).padStart(2, "0");
    return {
      id,
      userId: "owner",
      date: `2026-01-${day}`,
      title: id,
      description: null,
      referenceUrls: [],
      tags: [],
      project: null,
      createdAt: new Date(index),
      updatedAt: new Date(index),
    };
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ChunkResult = {
  summary: string;
  highlights: [];
  provider: string;
  model: string;
};

function chunkResult(summary: string): ChunkResult {
  return { summary, highlights: [], provider: "fake", model: "fake" };
}
