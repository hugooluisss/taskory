import type { TaskoryApiClient } from "../repositories/taskory-api.client.js";
import type { ReportJob, ReportResult, ReportStyles } from "../types/api.js";

export class UnknownProjectError extends Error {
  constructor(name: string) {
    super(`Project not found: ${name}`);
    this.name = "UnknownProjectError";
  }
}

export class ReportToolsService {
  constructor(private readonly api: TaskoryApiClient) {}

  generate(
    token: string,
    input: {
      from: string;
      to: string;
      projects?: string[];
      tags?: string[];
      language: "es" | "en";
      style?: "summary" | "detailed" | "custom";
      customPrompt?: string;
    },
  ): Promise<ReportResult | ReportJob> {
    return this.resolveAndGenerate(token, input);
  }

  private async resolveAndGenerate(
    token: string,
    input: {
      from: string;
      to: string;
      projects?: string[];
      tags?: string[];
      language: "es" | "en";
      style?: "summary" | "detailed" | "custom";
      customPrompt?: string;
    },
  ): Promise<ReportResult | ReportJob> {
    const catalog = input.projects?.length
      ? await this.api.listProjects(token)
      : [];
    const projectIds = input.projects?.map((name) => {
      const project = catalog.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (!project) throw new UnknownProjectError(name);
      return project.id;
    });
    const { projects: _projects, customPrompt, ...fields } = input;
    return this.api.createReport(token, {
      ...fields,
      ...(fields.style === "custom" ? { customPrompt: customPrompt?.trim() } : {}),
      ...(projectIds ? { projectIds: [...new Set(projectIds)] } : {}),
    });
  }

  listStyles(token: string): Promise<ReportStyles> {
    return this.api.listReportStyles(token);
  }

  get(token: string, id: string): Promise<ReportJob> {
    return this.api.getReport(token, id);
  }
}
