import { Injectable } from "@nestjs/common";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { ProjectsRepository } from "./projects.repository";

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}

  list(userId: string) {
    return this.projects.list(userId);
  }

  async get(userId: string, id: string) {
    const project = await this.projects.find(userId, id);
    if (!project) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    return project;
  }

  async getMany(userId: string, ids: string[]) {
    if (!ids.length) return [];
    const projects = await this.projects.findMany(userId, ids);
    if (projects.length !== ids.length)
      throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    return projects;
  }

  async create(userId: string, name: string) {
    if (!name.trim() || name.trim().length > 100)
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    try {
      return await this.projects.create(userId, name);
    } catch (error) {
      if (isDuplicate(error))
        throw new ApiException(409, ERROR_CODES.VALIDATION_ERROR);
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    values: { name?: string; archived?: boolean },
  ) {
    if (
      values.name !== undefined &&
      (!values.name.trim() || values.name.trim().length > 100)
    ) {
      throw new ApiException(400, ERROR_CODES.VALIDATION_ERROR);
    }
    try {
      const project = await this.projects.update(userId, id, values);
      if (!project) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
      return project;
    } catch (error) {
      if (isDuplicate(error))
        throw new ApiException(409, ERROR_CODES.VALIDATION_ERROR);
      throw error;
    }
  }

  async delete(userId: string, id: string) {
    try {
      if (!(await this.projects.delete(userId, id)))
        throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    } catch (error) {
      if (isForeignKey(error))
        throw new ApiException(409, ERROR_CODES.VALIDATION_ERROR);
      throw error;
    }
  }
}

function isDuplicate(error: unknown) {
  return mysqlErrorCode(error) === "ER_DUP_ENTRY";
}

function isForeignKey(error: unknown) {
  return ["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(
    mysqlErrorCode(error) ?? "",
  );
}

function mysqlErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if (
    "driverError" in error &&
    typeof error.driverError === "object" &&
    error.driverError !== null &&
    "code" in error.driverError &&
    typeof error.driverError.code === "string"
  ) {
    return error.driverError.code;
  }
  return undefined;
}
