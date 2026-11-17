import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1763400000000 implements MigrationInterface {
  name = "InitialSchema1763400000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL, "name" varchar NOT NULL, "passwordHash" varchar NOT NULL, "language" varchar NOT NULL DEFAULT ('en'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "name" varchar NOT NULL, "prefix" varchar NOT NULL, "keyHash" varchar NOT NULL, "lastUsedAt" datetime, "revokedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "activities" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "date" date NOT NULL, "title" varchar NOT NULL, "description" text, "referenceUrls" text NOT NULL, "tags" text NOT NULL, "project" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_jobs" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "status" varchar NOT NULL, "params" text NOT NULL, "activityIds" text NOT NULL, "chunkSize" integer NOT NULL, "progressDone" integer NOT NULL DEFAULT (0), "progressTotal" integer NOT NULL, "markdown" text, "provider" text, "model" text, "errorCode" text, "errorChunk" integer, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "finishedAt" datetime)`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "redirectUris" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_authorization_requests" ("id" varchar PRIMARY KEY NOT NULL, "clientId" varchar NOT NULL, "redirectUri" varchar NOT NULL, "codeChallenge" varchar NOT NULL, "state" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "expiresAt" datetime NOT NULL, "decidedAt" datetime, CONSTRAINT "FK_d063118d8cb1e037e2a0bb91b3d" FOREIGN KEY ("clientId") REFERENCES "oauth_clients" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_authorizations" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "clientId" varchar NOT NULL, "resource" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "lastUsedAt" datetime, "revokedAt" datetime, CONSTRAINT "FK_5baf2013e4d6649133b7ef56e38" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a494d8e0690fa092361fa09ae30" FOREIGN KEY ("clientId") REFERENCES "oauth_clients" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_authorization_codes" ("id" varchar PRIMARY KEY NOT NULL, "authorizationId" varchar NOT NULL, "codeHash" varchar NOT NULL, "codeChallenge" varchar NOT NULL, "redirectUri" varchar NOT NULL, "expiresAt" datetime NOT NULL, "usedAt" datetime, CONSTRAINT "FK_efd457a5b7a0cf49d82fef1d4b5" FOREIGN KEY ("authorizationId") REFERENCES "oauth_authorizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_tokens" ("id" varchar PRIMARY KEY NOT NULL, "authorizationId" varchar NOT NULL, "kind" varchar NOT NULL, "tokenHash" varchar NOT NULL, "expiresAt" datetime NOT NULL, "revokedAt" datetime, "rotatedAt" datetime, "parentTokenId" varchar, "codeId" varchar, "lastUsedAt" datetime, CONSTRAINT "FK_b0da1649fc4528a4cab23218787" FOREIGN KEY ("authorizationId") REFERENCES "oauth_authorizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_998a750b80cee0c092a7f23fcd3" FOREIGN KEY ("codeId") REFERENCES "oauth_authorization_codes" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_ea268300a90ca94da0a8a8efc18" FOREIGN KEY ("parentTokenId") REFERENCES "oauth_tokens" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_memory" ("reportId" varchar NOT NULL, "userId" varchar NOT NULL, "chunkIndex" integer NOT NULL, "dateFrom" date NOT NULL, "dateTo" date NOT NULL, "activityCount" integer NOT NULL, "summary" text NOT NULL, "highlights" text NOT NULL, "byProject" text NOT NULL, "byDay" text NOT NULL, CONSTRAINT "FK_a0c8fa2021677bdfaac714033fb" FOREIGN KEY ("reportId", "userId") REFERENCES "report_jobs" ("id", "userId") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("reportId", "userId", "chunkIndex"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_db1a97b0c69c2cc8544b4b1f1c" ON "oauth_authorizations" ("userId", "id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_58bb94603eb30f80714a60921b" ON "oauth_authorization_codes" ("codeHash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_095f87160acedf5dc5a8c9a814" ON "oauth_tokens" ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "report_jobs_id_user" ON "report_jobs" ("id", "userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "report_jobs_active_user" ON "report_jobs" ("userId") WHERE status IN ('queued', 'running')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "report_jobs_active_user"`);
    await queryRunner.query(`DROP INDEX "report_jobs_id_user"`);
    await queryRunner.query(`DROP INDEX "IDX_095f87160acedf5dc5a8c9a814"`);
    await queryRunner.query(`DROP INDEX "IDX_58bb94603eb30f80714a60921b"`);
    await queryRunner.query(`DROP INDEX "IDX_db1a97b0c69c2cc8544b4b1f1c"`);
    await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
    await queryRunner.query(`DROP TABLE "report_memory"`);
    await queryRunner.query(`DROP TABLE "oauth_tokens"`);
    await queryRunner.query(`DROP TABLE "oauth_authorization_codes"`);
    await queryRunner.query(`DROP TABLE "oauth_authorizations"`);
    await queryRunner.query(`DROP TABLE "oauth_authorization_requests"`);
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
    await queryRunner.query(`DROP TABLE "report_jobs"`);
    await queryRunner.query(`DROP TABLE "activities"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
