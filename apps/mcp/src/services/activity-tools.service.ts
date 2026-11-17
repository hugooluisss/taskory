import type { TaskoryApiClient } from "../repositories/taskory-api.client.js";
import type { Activity, ActivityList } from "../types/api.js";

export class ActivityToolsService {
  constructor(
    private readonly api: TaskoryApiClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  log(
    token: string,
    input: {
      title: string;
      date?: string;
      timezone?: string;
      description?: string;
      referenceUrls?: string[];
      tags?: string[];
      project?: string;
    },
  ): Promise<Activity> {
    const date = input.date ?? this.today(input.timezone);
    const { timezone: _timezone, ...activity } = input;
    return this.api.createActivity(token, { ...activity, date });
  }

  list(
    token: string,
    input: Record<string, string | number | undefined>,
  ): Promise<ActivityList> {
    return this.api.listActivities(token, input);
  }

  update(
    token: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Activity> {
    return this.api.updateActivity(token, id, input);
  }

  async delete(
    token: string,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.api.deleteActivity(token, id);
    return { deleted: true, id };
  }

  private today(timezone?: string): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(this.now());
  }
}
