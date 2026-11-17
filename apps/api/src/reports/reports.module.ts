import { Module } from "@nestjs/common";
import { ActivitiesModule } from "../activities/activities.module";
import { TokenAuthModule } from "../auth/token-auth.module";
import { ReportsController } from "./reports.controller";
import { reportGeneratorProvider } from "./report-generator.provider";
import { ReportsService } from "./reports.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportJob } from "./entities/report-job.entity";
import { ReportMemory } from "./entities/report-memory.entity";
import { ReportJobsRepository } from "./report-jobs.repository";
import { ReportMemoryRepository } from "./report-memory.repository";
import { ReportJobsService } from "./report-jobs.service";
import { ReportJobRunner } from "./report-job.runner";
import { REPORT_JOB_QUEUE } from "./report-job-queue";
import { DatabaseModule } from "../common/database/database.module";

@Module({
  imports: [
    ActivitiesModule,
    DatabaseModule,
    TokenAuthModule,
    TypeOrmModule.forFeature([ReportJob, ReportMemory]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    reportGeneratorProvider,
    ReportJobsRepository,
    ReportMemoryRepository,
    ReportJobsService,
    ReportJobRunner,
    { provide: REPORT_JOB_QUEUE, useExisting: ReportJobRunner },
  ],
})
export class ReportsModule {}
