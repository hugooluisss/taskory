import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { OAuthAuthorizationService } from "./oauth-authorization.service";
import { OAuthTokenService } from "./oauth-token.service";
import { OAuthError } from "./oauth-error";
import {
  getOauthAuthorizeRateLimit,
  getOauthRateLimit,
  getOauthRateWindowMs,
} from "./constants";
import { getPublicUrl } from "./public-url";
import { AuthorizeQueryDto } from "./dto/authorize-query.dto";
import { TokenRequestDto } from "./dto/token-request.dto";
import { RevokeRequestDto } from "./dto/revoke-request.dto";

@Controller("oauth")
export class OAuthController {
  constructor(
    private readonly authorization: OAuthAuthorizationService,
    private readonly tokens: OAuthTokenService,
  ) {}

  @Get("authorize")
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: getOauthAuthorizeRateLimit(),
      ttl: getOauthRateWindowMs(),
    },
  })
  async authorize(
    @Query() query: AuthorizeQueryDto,
    @Res() response: Response,
  ) {
    const result = await this.authorization.startAuthorization({
      response_type: query.response_type,
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      code_challenge: query.code_challenge,
      code_challenge_method: query.code_challenge_method,
      state: query.state,
      resource: query.resource,
      scope: query.scope,
    });
    if (result.kind === "error-no-redirect") {
      return response.status(400).json({
        error: result.error,
        error_description: result.errorDescription,
      });
    }
    if (result.kind === "error-redirect") {
      const target = new URL(result.redirectUri);
      target.searchParams.set("error", result.error);
      if (result.state !== undefined)
        target.searchParams.set("state", result.state);
      target.searchParams.set("iss", getPublicUrl());
      return response.redirect(302, target.toString());
    }
    const consentUrl = `${getPublicUrl()}/oauth/consent?request=${encodeURIComponent(result.requestId)}`;
    return response.redirect(302, consentUrl);
  }

  @Post("token")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: getOauthRateLimit(), ttl: getOauthRateWindowMs() },
  })
  async token(
    @Body() body: TokenRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    if (body.grant_type === "authorization_code") {
      const result = await this.tokens.exchangeAuthorizationCode({
        code: body.code!,
        codeVerifier: body.code_verifier!,
        clientId: body.client_id!,
        redirectUri: body.redirect_uri!,
        resource: body.resource,
      });
      return result;
    }
    if (body.grant_type === "refresh_token") {
      return this.tokens.refresh({
        refreshToken: body.refresh_token!,
        clientId: body.client_id!,
        resource: body.resource,
      });
    }
    throw new OAuthError(
      "unsupported_grant_type",
      "The grant type is not supported.",
      400,
    );
  }

  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: getOauthRateLimit(), ttl: getOauthRateWindowMs() },
  })
  async revoke(@Body() body: RevokeRequestDto | undefined) {
    await this.tokens.revoke({
      token: body?.token ?? "",
      tokenTypeHint: body?.token_type_hint,
      clientId: body?.client_id,
    });
    return {};
  }
}
