import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportJob } from "../reports/entities/report-job.entity";
import { Activity } from "../activities/entities/activity.entity";

@Injectable()
export class SharedReportsRepository {
  constructor(
    @InjectRepository(ReportJob) private readonly jobs: Repository<ReportJob>,
    @InjectRepository(Activity)
    private readonly activities: Repository<Activity>,
  ) {}
  findByHash(hash: string) {
    return this.jobs.findOne({ where: { shareTokenHash: hash } });
  }
  activitiesFor(job: ReportJob) {
    return job.activityIds.length
      ? this.activities
          .createQueryBuilder("activity")
          .leftJoinAndSelect("activity.projects", "project")
          .where("activity.userId = :userId", { userId: job.userId })
          .andWhere("activity.id IN (:...ids)", { ids: job.activityIds })
          .getMany()
      : Promise.resolve([]);
  }
}
