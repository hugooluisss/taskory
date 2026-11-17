import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, QueryFailedError, Repository } from "typeorm";
import { ReportJob } from "./entities/report-job.entity";
import { ActiveReportExistsError } from "./errors/active-report-exists.error";

@Injectable()
export class ReportJobsRepository {
  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
  ) {}

  create(values: Partial<ReportJob>): Promise<ReportJob> {
    return this.jobs.save(this.jobs.create(values)).catch((error: unknown) => {
      if (isActiveReportConstraint(error)) {
        throw new ActiveReportExistsError({ cause: error });
      }
      throw error;
    });
  }

  find(userId: string, id: string): Promise<ReportJob | null> {
    return this.jobs.findOne({ where: { userId, id } });
  }

  findActiveForUser(userId: string): Promise<ReportJob | null> {
    return this.jobs.findOne({
      where: [
        { userId, status: "queued" },
        { userId, status: "running" },
      ],
      order: { createdAt: "ASC" },
    });
  }

  findQueued(): Promise<ReportJob[]> {
    return this.jobs.find({
      where: { status: "queued" },
      order: { createdAt: "ASC" },
    });
  }

  findQueuedJob(userId: string, id: string): Promise<ReportJob | null> {
    return this.jobs.findOne({ where: { userId, id, status: "queued" } });
  }

  findRunning(): Promise<ReportJob[]> {
    return this.jobs.find({ where: { status: "running" } });
  }

  update(userId: string, id: string, values: Partial<ReportJob>) {
    return this.jobs.update({ userId, id }, values as never);
  }

  async retry(userId: string, id: string): Promise<boolean> {
    try {
      const result = await this.jobs.update(
        { userId, id, status: "failed" },
        {
          status: "queued",
          errorCode: null,
          errorChunk: null,
          finishedAt: null,
        },
      );
      return result.affected === 1;
    } catch (error) {
      if (isActiveReportConstraint(error)) {
        throw new ActiveReportExistsError({ cause: error });
      }
      throw error;
    }
  }

  async markRunningInterrupted(): Promise<void> {
    await this.jobs.update(
      { status: "running" },
      {
        status: "failed",
        errorCode: "INTERRUPTED",
        errorChunk: null,
        finishedAt: new Date(),
      },
    );
  }

  async ensureActiveJobIndex(): Promise<void> {
    // No index migration is needed because no earlier databases exist.
    await this.jobs.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS report_jobs_active_user " +
        "ON report_jobs(userId) WHERE status IN ('queued', 'running')",
    );
  }

  async findById(id: string): Promise<ReportJob | null> {
    return this.jobs.findOne({ where: { id } });
  }

  async remove(userId: string, id: string): Promise<boolean> {
    return this.jobs.manager.transaction(async (manager) => {
      const result = await manager
        .getRepository(ReportJob)
        .delete({ userId, id });
      return result.affected === 1;
    });
  }

  async purgeExpired(before: Date): Promise<{ id: string; userId: string }[]> {
    const expired = await this.jobs.find({
      select: { id: true, userId: true },
      where: { finishedAt: LessThan(before) },
    });
    return expired;
  }
}

function isActiveReportConstraint(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; message?: string };
  return (
    (driverError.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      driverError.code === "SQLITE_CONSTRAINT_PRIMARYKEY") &&
    driverError.message?.includes("report_jobs.userId") === true
  );
}
