import { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectCatalog1771000000000 implements MigrationInterface {
  name = "ProjectCatalog1771000000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "CREATE TABLE projects (id varchar(36) PRIMARY KEY, userId varchar(36) NOT NULL, name varchar(100) COLLATE utf8mb4_0900_ai_ci NOT NULL, archived tinyint(1) NOT NULL DEFAULT 0, createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updatedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE KEY projects_user_name (userId,name), KEY projects_user (userId), CONSTRAINT FK_projects_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci",
    );
    await q.query(`INSERT INTO projects (id,userId,name)
      WITH normalized AS (
        SELECT userId, CASE WHEN TRIM(project)='Mantenimientos de seguridad, SIGEI' THEN 'SIGEI' ELSE TRIM(project) END AS name,
          CASE WHEN TRIM(project)='Mantenimientos de seguridad, SIGEI' THEN 'SIGEI' ELSE TRIM(project) END COLLATE utf8mb4_0900_ai_ci AS projectKey
        FROM activities WHERE project IS NOT NULL AND TRIM(project) <> ''
      ), spelling_counts AS (
        SELECT userId,MIN(name) AS name,projectKey,COUNT(*) AS occurrences
        FROM normalized GROUP BY userId,projectKey,BINARY name
      ), ranked AS (
        SELECT userId,name,ROW_NUMBER() OVER (PARTITION BY userId,projectKey ORDER BY occurrences DESC, BINARY name ASC) AS rankNo
        FROM spelling_counts
      ) SELECT UUID(),userId,name FROM ranked WHERE rankNo=1`);
    await q.query(
      "CREATE TABLE activity_projects (activityId varchar(36) NOT NULL, projectId varchar(36) NOT NULL, PRIMARY KEY (activityId,projectId), KEY activity_projects_project (projectId), CONSTRAINT FK_activity_projects_activity FOREIGN KEY (activityId) REFERENCES activities(id) ON DELETE CASCADE, CONSTRAINT FK_activity_projects_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci",
    );
    await q.query(`INSERT INTO activity_projects (activityId,projectId)
      SELECT a.id,p.id FROM activities a
      JOIN projects p ON p.userId=a.userId AND p.name=(CASE WHEN TRIM(a.project)='Mantenimientos de seguridad, SIGEI' THEN 'SIGEI' ELSE TRIM(a.project) END) COLLATE utf8mb4_0900_ai_ci
      WHERE a.project IS NOT NULL AND TRIM(a.project) <> ''`);
    await q.query(
      "ALTER TABLE activities DROP INDEX activities_user_project, DROP COLUMN project",
    );
    await q.query(`UPDATE report_runs r JOIN (
      SELECT r.id, COALESCE(JSON_ARRAYAGG(p.id), JSON_ARRAY()) AS projectIds
      FROM report_runs r
      JOIN JSON_TABLE(r.projects, '$[*]' COLUMNS (name varchar(100) PATH '$')) names
      JOIN projects p ON p.userId=r.userId AND p.name=names.name COLLATE utf8mb4_0900_ai_ci
      GROUP BY r.id
    ) selected ON selected.id=r.id SET r.projects=selected.projectIds`);
    await q.query(`UPDATE report_jobs j SET j.params=JSON_REMOVE(JSON_SET(j.params, '$.projectIds', (
      SELECT COALESCE(JSON_ARRAYAGG(p.id), JSON_ARRAY())
      FROM JSON_TABLE(j.params, '$.projects[*]' COLUMNS (name varchar(100) PATH '$')) names
      JOIN projects p ON p.userId=j.userId AND p.name=names.name COLLATE utf8mb4_0900_ai_ci
    )), '$.projects') WHERE JSON_CONTAINS_PATH(j.params, 'one', '$.projects')`);
    await q.query(
      "ALTER TABLE report_runs RENAME COLUMN projects TO projectIds",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE report_runs r SET r.projectIds=(
      SELECT COALESCE(JSON_ARRAYAGG(p.name), JSON_ARRAY())
      FROM JSON_TABLE(r.projectIds, '$[*]' COLUMNS (id varchar(36) PATH '$')) selected
      JOIN projects p ON p.id=selected.id COLLATE utf8mb4_0900_ai_ci AND p.userId=r.userId
    )`);
    await q.query(`UPDATE report_jobs j SET j.params=JSON_REMOVE(JSON_SET(j.params, '$.projects', (
      SELECT COALESCE(JSON_ARRAYAGG(p.name), JSON_ARRAY())
      FROM JSON_TABLE(j.params, '$.projectIds[*]' COLUMNS (id varchar(36) PATH '$')) selected
      JOIN projects p ON p.id=selected.id COLLATE utf8mb4_0900_ai_ci AND p.userId=j.userId
    )), '$.projectIds') WHERE JSON_CONTAINS_PATH(j.params, 'one', '$.projectIds')`);
    await q.query(
      "ALTER TABLE report_runs RENAME COLUMN projectIds TO projects",
    );
    await q.query(
      "ALTER TABLE activities ADD project varchar(100) NULL, ADD KEY activities_user_project (userId,project(100))",
    );
    await q.query(
      "UPDATE activities a JOIN (SELECT ap.activityId, MIN(p.name) AS name FROM activity_projects ap JOIN projects p ON p.id=ap.projectId GROUP BY ap.activityId) selected ON selected.activityId=a.id SET a.project=selected.name",
    );
    await q.query("DROP TABLE activity_projects");
    await q.query("DROP TABLE projects");
  }
}
