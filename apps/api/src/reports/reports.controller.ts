import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
  Query,
} from "@nestjs/common";
import { Response } from "express";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthUser } from "../common/auth/auth-user";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";
import { ListReportRunsDto } from "./dto/list-report-runs.dto";

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("runs")
  listRuns(@CurrentUser() user: AuthUser, @Query() query: ListReportRunsDto) {
    return this.reports.listRuns(user.id, query.page, query.limit);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateReportDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.reports.create(user.id, body).then((result) => {
      response.status("id" in result ? HttpStatus.ACCEPTED : HttpStatus.OK);
      return result;
    });
  }

  @Get(":id")
  status(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("accept-language") acceptLanguage?: string,
  ) {
    return this.reports.status(user.id, id, acceptLanguage);
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.ACCEPTED)
  retry(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.reports.retry(user.id, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reports.delete(user.id, id);
  }
}
