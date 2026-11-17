import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { AuthUser } from "../common/auth/auth-user";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { ListActivitiesDto } from "./dto/list-activities.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { ActivitiesService } from "./activities.service";

@Controller("activities")
@UseGuards(AuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get("meta")
  meta(@CurrentUser() user: AuthUser) {
    return this.activities.meta(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() filters: ListActivitiesDto) {
    return this.activities.list(user.id, filters);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateActivityDto) {
    return this.activities.create(user.id, body);
  }

  @Get(":id")
  findById(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.activities.findById(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateActivityDto,
  ) {
    if (!body || !Object.values(body).some((value) => value !== undefined)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR" });
    }
    return this.activities.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.activities.delete(user.id, id);
  }
}
