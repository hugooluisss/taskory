import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { HealthModule } from "./health/health.module";
import { User } from "./users/entities/user.entity";
import { ApiKey } from "./api-keys/entities/api-key.entity";
import { ActivitiesModule } from "./activities/activities.module";
import { Activity } from "./activities/entities/activity.entity";
import { ReportsModule } from "./reports/reports.module";
import { ReportJob } from "./reports/entities/report-job.entity";
import { ReportMemory } from "./reports/entities/report-memory.entity";

const synchronize =
  process.env.DB_SYNCHRONIZE === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.DB_SYNCHRONIZE !== "false");

export function databaseOptions(
  databasePath = process.env.DATABASE_PATH ?? "taskory.sqlite",
) {
  return {
    type: "better-sqlite3" as const,
    database: databasePath,
    prepareDatabase: (database: { exec(sql: string): void }) =>
      database.exec("PRAGMA foreign_keys = ON"),
    entities: [User, ApiKey, Activity, ReportJob, ReportMemory],
    // ponytail: synchronization only supports early deployments; use migrations as the upgrade path.
    synchronize,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => databaseOptions() }),
    UsersModule,
    ApiKeysModule,
    AuthModule,
    HealthModule,
    ActivitiesModule,
    ReportsModule,
  ],
})
export class AppModule {}
