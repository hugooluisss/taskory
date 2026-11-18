import { MigrationInterface, QueryRunner } from "typeorm";

export class MySqlBaseline1770000000000 implements MigrationInterface {
  name = "MySqlBaseline1770000000000";

  async up(q: QueryRunner): Promise<void> {
    await this.create(
      q,
      "users",
      `CREATE TABLE users (id varchar(36) PRIMARY KEY, email varchar(320) NOT NULL UNIQUE, name varchar(255) NOT NULL, passwordHash varchar(255) NOT NULL, language varchar(2) NOT NULL DEFAULT 'en', createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updatedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "api_keys",
      `CREATE TABLE api_keys (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, name varchar(255) NOT NULL, prefix varchar(64) NOT NULL, keyHash varchar(255) NOT NULL, lastUsedAt datetime(3) NULL, revokedAt datetime(3) NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY IDX_df3b25181df0b4b59bd93f16e1 (keyHash), KEY api_keys_userId (userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "activities",
      `CREATE TABLE activities (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, date date NOT NULL, title varchar(200) NOT NULL, description text NULL, referenceUrls json NOT NULL, tags json NOT NULL, project varchar(100) NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updatedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), KEY activities_user_date (userId, date), KEY activities_user_project (userId, project(100))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "report_jobs",
      `CREATE TABLE report_jobs (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, status varchar(20) NOT NULL, activeUserId varchar(36) GENERATED ALWAYS AS (CASE WHEN status IN ('queued','running') THEN userId ELSE NULL END) VIRTUAL, params json NOT NULL, activityIds json NOT NULL, chunkSize int NOT NULL, progressDone int NOT NULL DEFAULT 0, progressTotal int NOT NULL, markdown mediumtext NULL, provider varchar(255) NULL, model varchar(255) NULL, errorCode varchar(255) NULL, errorChunk int NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), finishedAt datetime(3) NULL, totalTokens int NOT NULL DEFAULT 0, promptTokens int NOT NULL DEFAULT 0, completionTokens int NOT NULL DEFAULT 0, costMicros int NOT NULL DEFAULT 0, UNIQUE KEY report_jobs_id_user (id,userId), UNIQUE KEY report_jobs_active_user (activeUserId), KEY report_jobs_user (userId), CONSTRAINT FK_report_jobs_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "oauth_clients",
      `CREATE TABLE oauth_clients (id varchar(36) PRIMARY KEY, name varchar(255) NOT NULL, redirectUris json NOT NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "oauth_authorization_requests",
      `CREATE TABLE oauth_authorization_requests (id varchar(36) PRIMARY KEY, clientId varchar(36) NOT NULL, redirectUri varchar(2048) NOT NULL, codeChallenge varchar(128) NOT NULL, state text NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), expiresAt datetime(3) NOT NULL, decidedAt datetime(3) NULL, KEY oauth_requests_client (clientId), CONSTRAINT FK_d063118d8cb1e037e2a0bb91b3d FOREIGN KEY (clientId) REFERENCES oauth_clients(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "oauth_authorizations",
      `CREATE TABLE oauth_authorizations (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, clientId varchar(36) NOT NULL, resource varchar(2048) NOT NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), lastUsedAt datetime(3) NULL, revokedAt datetime(3) NULL, UNIQUE KEY IDX_db1a97b0c69c2cc8544b4b1f1c (userId,id), KEY oauth_authorizations_client (clientId), CONSTRAINT FK_5baf2013e4d6649133b7ef56e38 FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT FK_a494d8e0690fa092361fa09ae30 FOREIGN KEY (clientId) REFERENCES oauth_clients(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "oauth_authorization_codes",
      `CREATE TABLE oauth_authorization_codes (id varchar(36) PRIMARY KEY, authorizationId varchar(36) NOT NULL, codeHash varchar(255) NOT NULL, codeChallenge varchar(128) NOT NULL, redirectUri varchar(2048) NOT NULL, expiresAt datetime(3) NOT NULL, usedAt datetime(3) NULL, UNIQUE KEY IDX_58bb94603eb30f80714a60921b (codeHash), KEY oauth_codes_auth (authorizationId), CONSTRAINT FK_efd457a5b7a0cf49d82fef1d4b5 FOREIGN KEY (authorizationId) REFERENCES oauth_authorizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "oauth_tokens",
      `CREATE TABLE oauth_tokens (id varchar(36) PRIMARY KEY, authorizationId varchar(36) NOT NULL, kind varchar(20) NOT NULL, tokenHash varchar(255) NOT NULL, expiresAt datetime(3) NOT NULL, revokedAt datetime(3) NULL, rotatedAt datetime(3) NULL, parentTokenId varchar(36) NULL, codeId varchar(36) NULL, lastUsedAt datetime(3) NULL, UNIQUE KEY IDX_095f87160acedf5dc5a8c9a814 (tokenHash), KEY oauth_tokens_auth (authorizationId), KEY oauth_tokens_code (codeId), KEY oauth_tokens_parent (parentTokenId), CONSTRAINT FK_b0da1649fc4528a4cab23218787 FOREIGN KEY (authorizationId) REFERENCES oauth_authorizations(id) ON DELETE CASCADE, CONSTRAINT FK_998a750b80cee0c092a7f23fcd3 FOREIGN KEY (codeId) REFERENCES oauth_authorization_codes(id) ON DELETE SET NULL, CONSTRAINT FK_ea268300a90ca94da0a8a8efc18 FOREIGN KEY (parentTokenId) REFERENCES oauth_tokens(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "report_memory",
      `CREATE TABLE report_memory (reportId varchar(36) NOT NULL, userId varchar(36) NOT NULL, chunkIndex int NOT NULL, dateFrom date NOT NULL, dateTo date NOT NULL, activityCount int NOT NULL, summary mediumtext NOT NULL, highlights json NOT NULL, byProject json NOT NULL, byDay json NOT NULL, totalTokens int NOT NULL DEFAULT 0, promptTokens int NOT NULL DEFAULT 0, completionTokens int NOT NULL DEFAULT 0, PRIMARY KEY(reportId,userId,chunkIndex), KEY report_memory_job (reportId,userId), CONSTRAINT FK_a0c8fa2021677bdfaac714033fb FOREIGN KEY (reportId,userId) REFERENCES report_jobs(id,userId) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
    await this.create(
      q,
      "report_runs",
      `CREATE TABLE report_runs (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, jobId varchar(36) NULL, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`from\` date NOT NULL, \`to\` date NOT NULL, projects json NOT NULL, language varchar(2) NOT NULL, style varchar(20) NOT NULL, provider varchar(255) NOT NULL, model varchar(255) NOT NULL, promptTokens int NOT NULL, completionTokens int NOT NULL, totalTokens int NOT NULL, costMicros int NOT NULL, activityCount int NOT NULL, status varchar(20) NOT NULL, KEY report_runs_user_created (userId,createdAt), CONSTRAINT FK_report_runs_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    );
  }

  private async create(
    q: QueryRunner,
    table: string,
    sql: string,
  ): Promise<void> {
    try {
      await q.query(sql);
    } catch (error) {
      const warnings = await q.query("SHOW WARNINGS");
      throw new Error(
        `Failed creating ${table}: ${JSON.stringify(warnings)}; ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      "report_runs",
      "report_memory",
      "oauth_tokens",
      "oauth_authorization_codes",
      "oauth_authorizations",
      "oauth_authorization_requests",
      "oauth_clients",
      "report_jobs",
      "activities",
      "api_keys",
      "users",
    ])
      await q.query(`DROP TABLE ${table}`);
  }
}
