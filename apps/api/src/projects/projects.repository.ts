import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Project } from "./entities/project.entity";

@Injectable()
export class ProjectsRepository {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  list(userId: string) {
    return this.projects.find({ where: { userId }, order: { name: "ASC" } });
  }

  find(userId: string, id: string) {
    return this.projects.findOne({ where: { userId, id } });
  }

  findMany(userId: string, ids: string[]) {
    return this.projects.find({ where: { userId, id: In(ids) } });
  }

  create(userId: string, name: string, description: string | null) {
    return this.projects.save(
      this.projects.create({ userId, name: name.trim(), description }),
    );
  }

  async update(
    userId: string,
    id: string,
    values: Partial<Pick<Project, "name" | "archived" | "description">>,
  ) {
    await this.projects.update(
      { userId, id },
      { ...values, ...(values.name ? { name: values.name.trim() } : {}) },
    );
    return this.find(userId, id);
  }

  async delete(userId: string, id: string) {
    const result = await this.projects.delete({ userId, id });
    return result.affected === 1;
  }
}
