import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportSharing1772200000000 implements MigrationInterface {
  name = "ReportSharing1772200000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE report_jobs ADD shareTokenHash varchar(64) NULL",
    );
    await queryRunner.query(
      "CREATE UNIQUE INDEX report_jobs_share_token_hash ON report_jobs (shareTokenHash)",
    );
    await queryRunner.query(
      "ALTER TABLE report_jobs ADD shareExpiresAt datetime NULL",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE report_jobs DROP INDEX report_jobs_share_token_hash",
    );
    await queryRunner.query(
      "ALTER TABLE report_jobs DROP COLUMN shareExpiresAt",
    );
    await queryRunner.query(
      "ALTER TABLE report_jobs DROP COLUMN shareTokenHash",
    );
  }
}
