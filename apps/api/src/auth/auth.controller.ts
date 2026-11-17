import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { authRateLimit, authRateWindowMs } from "./auth.constants";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthGuard } from "./guards/auth.guard";
import { AuthRequest } from "../common/auth/auth-request";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: authRateLimit(), ttl: authRateWindowMs() } })
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.name, body.password);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: authRateLimit(), ttl: authRateWindowMs() } })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthRequest) {
    return this.auth.profile(request.user.id);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  update(@Req() request: AuthRequest, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.id, body);
  }
}
