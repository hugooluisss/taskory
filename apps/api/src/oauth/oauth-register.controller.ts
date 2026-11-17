import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ClientRegistrationService } from "./client-registration.service";
import { getOauthRateLimit, getOauthRateWindowMs } from "./constants";
import { RegisterOauthClientDto } from "./dto/register-oauth-client.dto";

@Controller("oauth/register")
export class OAuthRegisterController {
  constructor(private readonly registration: ClientRegistrationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: getOauthRateLimit(), ttl: getOauthRateWindowMs() },
  })
  async register(@Body() body: RegisterOauthClientDto) {
    const client = await this.registration.register(body);
    return {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: body.grant_types ?? ["authorization_code", "refresh_token"],
      response_types: body.response_types ?? ["code"],
    };
  }
}
