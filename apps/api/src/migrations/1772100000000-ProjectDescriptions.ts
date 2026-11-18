import { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectDescriptions1772100000000 implements MigrationInterface {
  name = "ProjectDescriptions1772100000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE projects ADD description text NULL");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE projects DROP COLUMN description");
  }
}
