import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthUser } from "../common/auth/auth-user";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("providers")
  providers() {
    return this.reports.listProviders();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateReportDto) {
    return this.reports.create(user.id, body);
  }
}
