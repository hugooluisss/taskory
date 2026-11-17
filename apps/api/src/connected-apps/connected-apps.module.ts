import { Module } from "@nestjs/common";
import { OAuthModule } from "../oauth/oauth.module";
import { ConnectedAppsService } from "./connected-apps.service";
import { ConnectedAppsController } from "./connected-apps.controller";
import { TokenAuthModule } from "../auth/token-auth.module";

@Module({
  imports: [OAuthModule, TokenAuthModule],
  controllers: [ConnectedAppsController],
  providers: [ConnectedAppsService],
  exports: [ConnectedAppsService],
})
export class ConnectedAppsModule {}
