import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { OAuthAuthorizationService } from "./oauth-authorization.service";
import { AuthGuard } from "../auth/guards/auth.guard";
import { JwtOnly } from "../auth/jwt-only.decorator";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { AuthUser } from "../common/auth/auth-user";
import { getOauthRateLimit, getOauthRateWindowMs } from "./constants";
import { RequestDecisionDto } from "./dto/request-decision.dto";

@Controller("oauth/requests")
@UseGuards(AuthGuard)
@JwtOnly()
export class OAuthRequestsController {
  constructor(private readonly authorization: OAuthAuthorizationService) {}

  @Get(":id")
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.authorization.getConsentRequest(id);
  }

  @Post(":id/decision")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: getOauthRateLimit(), ttl: getOauthRateWindowMs() },
  })
  decide(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: RequestDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authorization.decide(id, user.id, body.approve);
  }
}
