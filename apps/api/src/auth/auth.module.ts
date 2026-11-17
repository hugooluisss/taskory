import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersModule } from "../users/users.module";
import { AuthGuard } from "./guards/auth.guard";
import { authRateLimit, authRateWindowMs } from "./auth.constants";
import { TokenAuthModule } from "./token-auth.module";

@Module({
  imports: [
    UsersModule,
    TokenAuthModule,
    ThrottlerModule.forRoot([
      { ttl: authRateWindowMs(), limit: authRateLimit() },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, TokenAuthModule],
})
export class AuthModule {}
