import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { ReportMemory } from "./entities/report-memory.entity";
import { ReportNotFoundForMemoryError } from "./errors/report-not-found-for-memory.error";

@Injectable()
export class ReportMemoryRepository {
  constructor(
    @InjectRepository(ReportMemory)
    private readonly memory: Repository<ReportMemory>,
  ) {}

  async list(userId: string, reportId: string): Promise<ReportMemory[]> {
    return this.memory.find({
      where: { userId, reportId },
      order: { chunkIndex: "ASC" },
    });
  }

  async save(userId: string, row: ReportMemory): Promise<void> {
    try {
      await this.memory.save({ ...row, userId });
    } catch (error) {
      if (isMemoryForeignKeyFailure(error)) {
        throw new ReportNotFoundForMemoryError({ cause: error });
      }
      throw error;
    }
  }

  async remove(userId: string, reportId: string): Promise<void> {
    await this.memory.delete({ userId, reportId });
  }

  clear(userId: string, reportId: string): Promise<unknown> {
    return this.memory.delete({ userId, reportId });
  }
}

function isMemoryForeignKeyFailure(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string };
  return driverError.code === "ER_NO_REFERENCED_ROW_2";
}
