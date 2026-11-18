import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import {
  pagination,
  PaginationEnvelope,
} from "../common/pagination/pagination";
import { Activity } from "./entities/activity.entity";
import {
  ActivityFilters,
  CreateActivityInput,
  ReportActivityFilters,
  UpdateActivityInput,
} from "./types";

export interface ActivityMeta {
  projects: string[];
  tags: string[];
}

@Injectable()
export class ActivitiesRepository {
  constructor(
    @InjectRepository(Activity)
    private readonly activities: Repository<Activity>,
  ) {}

  async create(userId: string, values: CreateActivityInput): Promise<Activity> {
    const { projectIds = [], ...activityValues } = values;
    const activity = await this.activities.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(Activity);
        const created = await repository.save(
          repository.create({ ...activityValues, userId }),
        );
        if (projectIds.length) {
          await manager
            .createQueryBuilder()
            .insert()
            .into("activity_projects")
            .values(
              projectIds.map((projectId) => ({
                activityId: created.id,
                projectId,
              })),
            )
            .execute();
        }
        return created;
      },
    );
    return (await this.findById(userId, activity.id))!;
  }

  findById(userId: string, id: string): Promise<Activity | null> {
    return this.activities.findOne({
      where: { userId, id },
      relations: { projects: true },
    });
  }

  async update(
    userId: string,
    id: string,
    values: UpdateActivityInput,
  ): Promise<Activity | null> {
    const { projectIds, ...activityValues } = values;
    await this.activities.manager.transaction(async (manager) => {
      const result = await manager
        .getRepository(Activity)
        .update({ userId, id }, activityValues);
      if (result.affected !== 1 || projectIds === undefined) return;
      await manager.query(
        "DELETE FROM activity_projects WHERE activityId = ?",
        [id],
      );
      if (projectIds.length) {
        await manager
          .createQueryBuilder()
          .insert()
          .into("activity_projects")
          .values(
            projectIds.map((projectId) => ({ activityId: id, projectId })),
          )
          .execute();
      }
    });
    return this.findById(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.activities.delete({ userId, id });
    return result.affected === 1;
  }

  async list(
    userId: string,
    filters: ActivityFilters,
  ): Promise<PaginationEnvelope<Activity>> {
    const { page, limit, skip } = pagination(filters.page, filters.limit);
    const query = this.activities.createQueryBuilder("activity");
    this.applyFilters(query, userId, filters);
    const [items, total] = await query
      .leftJoinAndSelect("activity.projects", "project")
      .orderBy("activity.date", "DESC")
      .addOrderBy("activity.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  findForReport(
    userId: string,
    filters: ReportActivityFilters,
  ): Promise<Activity[]> {
    const query = this.reportQuery(userId, filters).leftJoinAndSelect(
      "activity.projects",
      "project",
    );
    return query
      .orderBy("activity.date", "ASC")
      .addOrderBy("activity.createdAt", "ASC")
      .take(3001)
      .getMany();
  }

  async findReportSnapshot(
    userId: string,
    filters: ReportActivityFilters,
  ): Promise<{ id: string }[]> {
    const query = this.reportQuery(userId, filters).select("activity.id", "id");
    return (
      await query
        .orderBy("activity.date", "ASC")
        .addOrderBy("activity.createdAt", "ASC")
        .take(3001)
        .getRawMany<{ id: string }>()
    ).map(({ id }) => ({ id }));
  }

  findReportChunk(userId: string, ids: string[]): Promise<Activity[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.activities
      .createQueryBuilder("activity")
      .where("activity.userId = :userId", { userId })
      .andWhere("activity.id IN (:...ids)", { ids })
      .leftJoinAndSelect("activity.projects", "project")
      .getMany();
  }

  private reportQuery(userId: string, filters: ReportActivityFilters) {
    const query = this.activities
      .createQueryBuilder("activity")
      .where("activity.userId = :userId", { userId })
      .andWhere("activity.date >= :from", { from: filters.from })
      .andWhere("activity.date <= :to", { to: filters.to });
    if (filters.projectIds?.length) {
      query.andWhere(
        "EXISTS (SELECT 1 FROM activity_projects ap WHERE ap.activityId=activity.id AND ap.projectId IN (:...projectIds))",
        { projectIds: filters.projectIds },
      );
    }
    if (filters.tags?.length) {
      query.andWhere("JSON_OVERLAPS(activity.tags, CAST(:tagsJson AS JSON))", {
        tagsJson: JSON.stringify(filters.tags),
      });
    }
    return query;
  }

  async meta(userId: string): Promise<ActivityMeta> {
    const projects = (await this.activities.manager.query(
      "SELECT DISTINCT p.name AS project FROM activities a JOIN activity_projects ap ON ap.activityId=a.id JOIN projects p ON p.id=ap.projectId WHERE a.userId=? AND p.archived=0 ORDER BY p.name",
      [userId],
    )) as { project: string }[];
    const tags = (await this.activities.query(
      "SELECT DISTINCT jt.tag AS tag FROM activities CROSS JOIN JSON_TABLE(activities.tags, '$[*]' COLUMNS (tag varchar(255) PATH '$')) jt WHERE userId = ? ORDER BY jt.tag",
      [userId],
    )) as { tag: string }[];
    return {
      projects: projects.map((row) => row.project),
      tags: tags.map((row) => row.tag),
    };
  }

  private applyFilters(
    query: SelectQueryBuilder<Activity>,
    userId: string,
    filters: ActivityFilters,
  ): void {
    query.where("activity.userId = :userId", { userId });
    if (filters.from) {
      query.andWhere("activity.date >= :from", { from: filters.from });
    }
    if (filters.to) {
      query.andWhere("activity.date <= :to", { to: filters.to });
    }
    if (filters.projectIds?.length) {
      query.andWhere(
        "EXISTS (SELECT 1 FROM activity_projects ap WHERE ap.activityId=activity.id AND ap.projectId IN (:...projectIds))",
        { projectIds: filters.projectIds },
      );
    }
    if (filters.tag) {
      query.andWhere("JSON_CONTAINS(activity.tags, JSON_QUOTE(:tag))", {
        tag: filters.tag,
      });
    }
    if (filters.q) {
      const escaped = filters.q.replace(/[=%_]/g, "=$&");
      query.andWhere(
        "(activity.title LIKE :search ESCAPE '=' OR activity.description LIKE :search ESCAPE '=')",
        { search: `%${escaped}%` },
      );
    }
  }
}
