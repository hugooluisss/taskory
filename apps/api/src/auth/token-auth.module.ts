import { Module } from "@nestjs/common";
import { ApiKeysCoreModule } from "../api-keys/api-keys-core.module";
import { UsersModule } from "../users/users.module";
import { AuthService } from "./auth.service";
import { TokenAuthService } from "./token-auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { OAuthModule } from "../oauth/oauth.module";

@Module({
  imports: [UsersModule, ApiKeysCoreModule, OAuthModule],
  providers: [AuthService, TokenAuthService, AuthGuard],
  exports: [TokenAuthService, AuthGuard],
})
export class TokenAuthModule {}
