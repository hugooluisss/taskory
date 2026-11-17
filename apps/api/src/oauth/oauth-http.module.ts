import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { TokenAuthModule } from "../auth/token-auth.module";
import { OAuthModule } from "./oauth.module";
import { OAuthController } from "./oauth.controller";
import { OAuthMetadataController } from "./oauth-metadata.controller";
import { OAuthRegisterController } from "./oauth-register.controller";
import { OAuthRequestsController } from "./oauth-requests.controller";
import { ConnectedAppsModule } from "../connected-apps/connected-apps.module";

@Module({
  imports: [
    OAuthModule,
    TokenAuthModule,
    ConnectedAppsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
  ],
  controllers: [
    OAuthController,
    OAuthMetadataController,
    OAuthRegisterController,
    OAuthRequestsController,
  ],
})
export class OAuthHttpModule {}
