import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthUser } from "../common/auth/auth-user";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.projects.list(user.id)).map((project) =>
      this.serialize(project),
    );
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateProjectDto) {
    return this.serialize(await this.projects.create(user.id, body.name));
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.serialize(await this.projects.update(user.id, id, body));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.projects.delete(user.id, id);
  }

  private serialize(project: Awaited<ReturnType<ProjectsService["create"]>>) {
    return {
      id: project.id,
      name: project.name,
      archived: project.archived,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
