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
import { OAuthClient } from "./oauth/entities/oauth-client.entity";
import { OAuthAuthorizationRequest } from "./oauth/entities/oauth-authorization-request.entity";
import { OAuthAuthorization } from "./oauth/entities/oauth-authorization.entity";
import { OAuthAuthorizationCode } from "./oauth/entities/oauth-authorization-code.entity";
import { OAuthToken } from "./oauth/entities/oauth-token.entity";
import { OAuthModule } from "./oauth/oauth.module";
import { ConnectedAppsModule } from "./connected-apps/connected-apps.module";
import { OAuthHttpModule } from "./oauth/oauth-http.module";
import { InitialSchema1763400000000 } from "./migrations/1763400000000-InitialSchema";

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
    entities: [
      User,
      ApiKey,
      Activity,
      ReportJob,
      ReportMemory,
      OAuthClient,
      OAuthAuthorizationRequest,
      OAuthAuthorization,
      OAuthAuthorizationCode,
      OAuthToken,
    ],
    migrations: [InitialSchema1763400000000],
    synchronize,
    migrationsRun: !synchronize,
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
    OAuthModule,
    ConnectedAppsModule,
    OAuthHttpModule,
  ],
})
export class AppModule {}
