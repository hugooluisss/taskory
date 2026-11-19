import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { SharedReportsRepository } from "./shared-reports.repository";

@Injectable()
export class SharedReportsService {
  constructor(private readonly reports: SharedReportsRepository) {}
  async get(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    const job = await this.reports.findByHash(
      createHash("sha256").update(token).digest("hex"),
    );
    if (!job) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    if (!job.shareExpiresAt || job.shareExpiresAt.getTime() <= Date.now())
      throw new ApiException(410, ERROR_CODES.SHARE_EXPIRED);
    const rows = await this.reports.activitiesFor(job);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      period: { from: job.params.from, to: job.params.to },
      language: job.params.language,
      projects: (job.params.projects ?? []).map(({ name }) => name),
      activities: job.activityIds
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => !!row)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ date, title, description, projects, tags, referenceUrls }) => ({
          date,
          title,
          description,
          projects: projects.map(({ name }) => name),
          tags,
          referenceUrls,
        })),
    };
  }
}
