import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportStyles1772000000000 implements MigrationInterface {
  name = "ReportStyles1772000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users ADD customReportPrompt text NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users DROP COLUMN customReportPrompt");
  }
}
