import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportRuns1763500000000 implements MigrationInterface {
  name = "ReportRuns1763500000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_jobs" ADD "totalTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_memory" ADD "totalTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" ADD "promptTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" ADD "completionTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" ADD "costMicros" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_memory" ADD "promptTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_memory" ADD "completionTokens" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_runs" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "jobId" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "from" date NOT NULL, "to" date NOT NULL, "projects" text NOT NULL, "language" varchar NOT NULL, "style" varchar NOT NULL, "provider" varchar NOT NULL, "model" varchar NOT NULL, "promptTokens" integer NOT NULL, "completionTokens" integer NOT NULL, "totalTokens" integer NOT NULL, "costMicros" integer NOT NULL, "activityCount" integer NOT NULL, "status" varchar NOT NULL, CONSTRAINT "FK_report_runs_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "report_runs_user_created" ON "report_runs" ("userId", "createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "report_runs_user_created"`);
    await queryRunner.query(`DROP TABLE "report_runs"`);
    await queryRunner.query(
      `ALTER TABLE "report_memory" DROP COLUMN "totalTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_memory" DROP COLUMN "completionTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_memory" DROP COLUMN "promptTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" DROP COLUMN "costMicros"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" DROP COLUMN "completionTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" DROP COLUMN "promptTokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_jobs" DROP COLUMN "totalTokens"`,
    );
  }
}
