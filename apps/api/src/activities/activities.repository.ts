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

  create(userId: string, values: CreateActivityInput): Promise<Activity> {
    return this.activities.save(this.activities.create({ ...values, userId }));
  }

  findById(userId: string, id: string): Promise<Activity | null> {
    return this.activities.findOne({ where: { userId, id } });
  }

  async update(
    userId: string,
    id: string,
    values: UpdateActivityInput,
  ): Promise<Activity | null> {
    await this.activities.update({ userId, id }, values);
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
    const query = this.activities
      .createQueryBuilder("activity")
      .where("activity.userId = :userId", { userId })
      .andWhere("activity.date >= :from", { from: filters.from })
      .andWhere("activity.date <= :to", { to: filters.to });
    if (filters.project) {
      query.andWhere("activity.project = :project", {
        project: filters.project,
      });
    }
    if (filters.tags?.length) {
      query.andWhere(
        "EXISTS (SELECT 1 FROM json_each(activity.tags) WHERE json_each.value IN (:...tags))",
        { tags: filters.tags },
      );
    }
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
      .getMany();
  }

  private reportQuery(userId: string, filters: ReportActivityFilters) {
    const query = this.activities
      .createQueryBuilder("activity")
      .where("activity.userId = :userId", { userId })
      .andWhere("activity.date >= :from", { from: filters.from })
      .andWhere("activity.date <= :to", { to: filters.to });
    if (filters.project) {
      query.andWhere("activity.project = :project", {
        project: filters.project,
      });
    }
    if (filters.tags?.length) {
      query.andWhere(
        "EXISTS (SELECT 1 FROM json_each(activity.tags) WHERE json_each.value IN (:...tags))",
        { tags: filters.tags },
      );
    }
    return query;
  }

  async meta(userId: string): Promise<ActivityMeta> {
    const projects = await this.activities
      .createQueryBuilder("activity")
      .select("activity.project", "project")
      .where("activity.userId = :userId", { userId })
      .andWhere("activity.project IS NOT NULL")
      .distinct(true)
      .orderBy("activity.project", "ASC")
      .getRawMany<{ project: string }>();
    const tags = (await this.activities.query(
      "SELECT DISTINCT value AS tag FROM activities, json_each(activities.tags) WHERE userId = ? ORDER BY value",
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
    if (filters.project) {
      query.andWhere("activity.project = :project", {
        project: filters.project,
      });
    }
    if (filters.tag) {
      query.andWhere(
        "EXISTS (SELECT 1 FROM json_each(activity.tags) WHERE json_each.value = :tag)",
        { tag: filters.tag },
      );
    }
    if (filters.q) {
      const escaped = filters.q.replace(/[\\%_]/g, "\\$&");
      query.andWhere(
        "(activity.title LIKE :search ESCAPE '\\' COLLATE NOCASE " +
          "OR activity.description LIKE :search ESCAPE '\\' COLLATE NOCASE)",
        { search: `%${escaped}%` },
      );
    }
  }
}
