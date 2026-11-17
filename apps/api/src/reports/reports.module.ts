import { Module } from "@nestjs/common";
import { ActivitiesModule } from "../activities/activities.module";
import { TokenAuthModule } from "../auth/token-auth.module";
import { ReportsController } from "./reports.controller";
import { reportGeneratorProvider } from "./report-generator.provider";
import { ReportsService } from "./reports.service";

@Module({
  imports: [ActivitiesModule, TokenAuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, reportGeneratorProvider],
})
export class ReportsModule {}
