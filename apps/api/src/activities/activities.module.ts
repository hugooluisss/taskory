import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TokenAuthModule } from "../auth/token-auth.module";
import { Activity } from "./entities/activity.entity";
import { ActivitiesController } from "./activities.controller";
import { ActivitiesRepository } from "./activities.repository";
import { ActivitiesService } from "./activities.service";
import { ACTIVITY_CLOCK } from "./activities.service";

@Module({
  imports: [TypeOrmModule.forFeature([Activity]), TokenAuthModule],
  controllers: [ActivitiesController],
  providers: [
    ActivitiesRepository,
    ActivitiesService,
    { provide: ACTIVITY_CLOCK, useValue: () => new Date() },
  ],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
