import type { TaskoryApiClient } from "../repositories/taskory-api.client.js";
import type { Activity, ActivityList } from "../types/api.js";

export class ActivityToolsService {
  constructor(
    private readonly api: TaskoryApiClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async log(
    token: string,
    input: {
      title: string;
      date?: string;
      timezone?: string;
      description?: string;
      referenceUrls?: string[];
      tags?: string[];
      project?: string;
      projects?: string[];
    },
  ): Promise<Activity> {
    const date = input.date ?? this.today(input.timezone);
    const { timezone: _timezone, project, projects, ...activity } = input;
    const names = [...(projects ?? []), ...(project ? [project] : [])];
    const projectIds = await this.resolveProjectIds(token, names);
    return this.api.createActivity(token, {
      ...activity,
      date,
      ...(names.length ? { projectIds } : {}),
    });
  }

  async list(
    token: string,
    input: Record<string, string | number | undefined>,
  ): Promise<ActivityList> {
    const { project, ...filters } = input;
    if (typeof project !== "string")
      return this.api.listActivities(token, filters);
    const projects = await this.api.listProjects(token);
    const match = projects.find(
      (item) => item.name.toLowerCase() === project.toLowerCase(),
    );
    return match
      ? this.api.listActivities(token, { ...filters, projectIds: match.id })
      : {
          items: [],
          total: 0,
          page: Number(filters.page ?? 1),
          limit: Number(filters.limit ?? 50),
        };
  }

  async projects(token: string) {
    return (await this.api.listProjects(token)).filter(
      (project) => !project.archived,
    );
  }

  update(
    token: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Activity> {
    return this.updateWithProjects(token, id, input);
  }

  private async updateWithProjects(
    token: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Activity> {
    const { project, projects, ...fields } = input;
    if (project !== undefined || projects !== undefined) {
      const names = [
        ...(Array.isArray(projects) ? (projects as string[]) : []),
        ...(typeof project === "string" ? [project] : []),
      ];
      fields.projectIds = await this.resolveProjectIds(token, names);
    }
    return this.api.updateActivity(token, id, fields);
  }

  private async resolveProjectIds(
    token: string,
    names: string[],
  ): Promise<string[]> {
    const namesByLowercase = new Map<string, string>();
    for (const name of names) {
      if (!namesByLowercase.has(name.toLowerCase())) {
        namesByLowercase.set(name.toLowerCase(), name);
      }
    }
    const uniqueNames = [...namesByLowercase.values()];
    const catalog = uniqueNames.length
      ? await this.api.listProjects(token)
      : [];
    const ids: string[] = [];
    for (const name of uniqueNames) {
      let project = catalog.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (!project) {
        project = await this.api.createProject(token, { name });
        catalog.push(project);
      }
      ids.push(project.id);
    }
    return [...new Set(ids)];
  }

  createProject(token: string, input: { name: string; description?: string }) {
    return this.api.createProject(token, input);
  }

  async updateProject(
    token: string,
    input: {
      id?: string;
      name?: string;
      description?: string | null;
      archived?: boolean;
    },
  ) {
    const { id, name, ...fields } = input;
    const projectId = id ?? (await this.resolveProject(token, name!)).id;
    return this.api.updateProject(token, projectId, {
      ...fields,
      ...(id && name ? { name } : {}),
    });
  }

  private async resolveProject(token: string, name: string) {
    const project = (await this.api.listProjects(token)).find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (!project)
      throw new Error(`PROJECT_NOT_FOUND: Project not found: ${name}`);
    return project;
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
