import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { ReportJob } from "../reports/entities/report-job.entity";
import { Activity } from "../activities/entities/activity.entity";
import { SharedReportsController } from "./shared-reports.controller";
import { SharedReportsService } from "./shared-reports.service";
import { SharedReportsRepository } from "./shared-reports.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportJob, Activity]),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [SharedReportsController],
  providers: [SharedReportsService, SharedReportsRepository],
})
export class SharedReportsModule {}
