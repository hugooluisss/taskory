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
import { ReportRun } from "./reports/entities/report-run.entity";
import { OAuthClient } from "./oauth/entities/oauth-client.entity";
import { OAuthAuthorizationRequest } from "./oauth/entities/oauth-authorization-request.entity";
import { OAuthAuthorization } from "./oauth/entities/oauth-authorization.entity";
import { OAuthAuthorizationCode } from "./oauth/entities/oauth-authorization-code.entity";
import { OAuthToken } from "./oauth/entities/oauth-token.entity";
import { OAuthModule } from "./oauth/oauth.module";
import { ConnectedAppsModule } from "./connected-apps/connected-apps.module";
import { OAuthHttpModule } from "./oauth/oauth-http.module";
import { MySqlBaseline1770000000000 } from "./migrations/1770000000000-MySqlBaseline";
import { Project } from "./projects/entities/project.entity";
import { ProjectsModule } from "./projects/projects.module";
import { ProjectCatalog1771000000000 } from "./migrations/1771000000000-ProjectCatalog";
import { ReportStyles1772000000000 } from "./migrations/1772000000000-ReportStyles";
import { ProjectDescriptions1772100000000 } from "./migrations/1772100000000-ProjectDescriptions";

export function databaseOptions() {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for MySQL connection`);
    return value;
  };
  return {
    type: "mysql" as const,
    host: required("DB_HOST"),
    port: Number(required("DB_PORT")),
    database: required("DB_NAME"),
    username: required("DB_USER"),
    password: required("DB_PASSWORD"),
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: ["DATE"],
    extra: { connectionLimit: 10 },
    entities: [
      User,
      ApiKey,
      Activity,
      Project,
      ReportJob,
      ReportMemory,
      ReportRun,
      OAuthClient,
      OAuthAuthorizationRequest,
      OAuthAuthorization,
      OAuthAuthorizationCode,
      OAuthToken,
    ],
    migrations: [
      MySqlBaseline1770000000000,
      ProjectCatalog1771000000000,
      ReportStyles1772000000000,
      ProjectDescriptions1772100000000,
    ],
    synchronize: false,
    migrationsRun: true,
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
    ProjectsModule,
    ReportsModule,
    OAuthModule,
    ConnectedAppsModule,
    OAuthHttpModule,
  ],
})
export class AppModule {}
