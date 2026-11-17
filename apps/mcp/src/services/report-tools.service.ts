import type { TaskoryApiClient } from "../repositories/taskory-api.client.js";
import type { ReportJob, ReportResult } from "../types/api.js";

export class ReportToolsService {
  constructor(private readonly api: TaskoryApiClient) {}

  generate(
    token: string,
    input: {
      from: string;
      to: string;
      project?: string;
      tags?: string[];
      language: "es" | "en";
      provider?: string;
      model?: string;
      style?: "summary" | "detailed";
    },
  ): Promise<ReportResult | ReportJob> {
    return this.api.createReport(token, input);
  }

  get(token: string, id: string): Promise<ReportJob> {
    return this.api.getReport(token, id);
  }
}
