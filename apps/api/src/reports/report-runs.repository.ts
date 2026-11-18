import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import {
  pagination,
  PaginationEnvelope,
} from "../common/pagination/pagination";
import { ReportRun } from "./entities/report-run.entity";

export type ReportRunResponse = Omit<ReportRun, "costMicros"> & {
  costUsd: number;
};

@Injectable()
export class ReportRunsRepository {
  constructor(
    @InjectRepository(ReportRun) private readonly runs: Repository<ReportRun>,
    private readonly transactions: TransactionRunner,
  ) {}

  save(run: Omit<ReportRun, "id" | "createdAt">): Promise<ReportRun> {
    return this.transactions.run(async (manager) =>
      manager.getRepository(ReportRun).save(run),
    );
  }

  async list(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginationEnvelope<ReportRunResponse>> {
    const paging = pagination(page, limit);
    const [items, total] = await this.runs.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: paging.skip,
      take: paging.limit,
    });
    return {
      items: items.map(({ costMicros, ...run }) => ({
        ...run,
        costUsd: costMicros / 1_000_000,
      })),
      total,
      page: paging.page,
      limit: paging.limit,
    };
  }
}
