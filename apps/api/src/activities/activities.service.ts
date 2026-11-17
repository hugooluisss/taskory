import { Inject, Injectable } from "@nestjs/common";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { ActivitiesRepository } from "./activities.repository";
import {
  ActivityFilters,
  CreateActivityInput,
  UpdateActivityInput,
  ReportActivityFilters,
} from "./types";
import { Activity } from "./entities/activity.entity";
import { isCalendarDate } from "../common/dates/is-calendar-date";

export const ACTIVITY_CLOCK = Symbol("ACTIVITY_CLOCK");

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activities: ActivitiesRepository,
    @Inject(ACTIVITY_CLOCK) private readonly now: () => Date,
  ) {}

  create(userId: string, values: CreateActivityInput) {
    return this.activities.create(userId, {
      ...values,
      description: values.description ?? null,
      project: values.project ?? null,
      referenceUrls: values.referenceUrls ?? [],
      tags: this.normalizeTags(values.tags ?? []),
    });
  }

  async findById(userId: string, id: string): Promise<Activity> {
    const activity = await this.activities.findById(userId, id);
    if (!activity) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    return activity;
  }

  async update(userId: string, id: string, values: UpdateActivityInput) {
    const update = { ...values };
    if (values.tags) update.tags = this.normalizeTags(values.tags);
    update.updatedAt = this.now();
    const activity = await this.activities.update(userId, id, update);
    if (!activity) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    return activity;
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.activities.delete(userId, id))) {
      throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    }
  }

  async list(userId: string, filters: ActivityFilters) {
    if (filters.from && !isCalendarDate(filters.from)) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (filters.to && !isCalendarDate(filters.to)) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    return this.activities.list(userId, {
      ...filters,
      tag: filters.tag ? this.normalizeTags([filters.tag])[0] : undefined,
    });
  }

  meta(userId: string) {
    return this.activities.meta(userId);
  }

  findForReport(userId: string, filters: ReportActivityFilters) {
    return this.activities.findForReport(userId, {
      ...filters,
      tags: filters.tags ? this.normalizeTags(filters.tags) : undefined,
    });
  }

  findReportSnapshot(userId: string, filters: ReportActivityFilters) {
    return this.activities.findReportSnapshot(userId, {
      ...filters,
      tags: filters.tags ? this.normalizeTags(filters.tags) : undefined,
    });
  }

  findReportChunk(userId: string, ids: string[]) {
    return this.activities.findReportChunk(userId, ids);
  }

  private normalizeTags(tags: string[]): string[] {
    return [
      ...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
    ];
  }
}
