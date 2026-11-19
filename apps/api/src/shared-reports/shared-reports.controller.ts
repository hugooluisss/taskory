import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { getOauthRateLimit, getOauthRateWindowMs } from "../oauth/constants";
import { SharedReportsService } from "./shared-reports.service";

@Controller("shared")
export class SharedReportsController {
  constructor(private readonly reports: SharedReportsService) {}
  @Get(":token")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: getOauthRateLimit(), ttl: getOauthRateWindowMs() },
  })
  async get(
    @Param("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Robots-Tag", "noindex");
    return this.reports.get(token);
  }
}
