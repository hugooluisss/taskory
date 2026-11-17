import { Inject, Injectable } from "@nestjs/common";
import {
  LlmUnavailableError,
  UnknownProviderError,
  ReportGenerator,
} from "@taskory/llm";
import { ActivitiesService } from "../activities/activities.service";
import { Activity } from "../activities/entities/activity.entity";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { isCalendarDate } from "../common/dates/is-calendar-date";
import { MAX_REPORT_ACTIVITIES } from "./constants";
import { CreateReportDto } from "./dto/create-report.dto";
import { REPORT_GENERATOR } from "./report-generator.provider";

@Injectable()
export class ReportsService {
  constructor(
    private readonly activities: ActivitiesService,
    @Inject(REPORT_GENERATOR) private readonly generator: ReportGenerator,
  ) {}

  listProviders() {
    return this.generator.listProviders();
  }

  async create(userId: string, input: CreateReportDto) {
    if (
      !isCalendarDate(input.from) ||
      !isCalendarDate(input.to) ||
      input.from > input.to
    ) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!this.generator.hasProvider(input.provider)) {
      throw new ApiException(400, ERROR_CODES.UNKNOWN_PROVIDER);
    }
    const activities = await this.activities.findForReport(userId, {
      from: input.from,
      to: input.to,
      project: input.project,
      tags: input.tags,
    });
    if (activities.length === 0) {
      throw new ApiException(422, ERROR_CODES.NO_ACTIVITIES);
    }
    if (activities.length > MAX_REPORT_ACTIVITIES) {
      throw new ApiException(422, ERROR_CODES.RANGE_TOO_LARGE);
    }
    try {
      const result = await this.generator.generate({
        activities: activities.map((activity: Activity) => ({
          id: activity.id,
          date: activity.date,
          title: activity.title,
          description: activity.description,
          referenceUrls: activity.referenceUrls,
          tags: activity.tags,
          project: activity.project,
        })),
        from: input.from,
        to: input.to,
        project: input.project,
        language: input.language,
        provider: input.provider,
        model: input.model,
        style: input.style,
      });
      return { ...result, activityCount: activities.length };
    } catch (error) {
      if (error instanceof UnknownProviderError) {
        throw new ApiException(400, ERROR_CODES.UNKNOWN_PROVIDER);
      }
      if (error instanceof LlmUnavailableError) {
        throw new ApiException(502, ERROR_CODES.LLM_UNAVAILABLE);
      }
      throw error;
    }
  }
}
