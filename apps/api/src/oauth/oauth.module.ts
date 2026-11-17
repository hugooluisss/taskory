import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { OAuthAuthorizationService } from "./oauth-authorization.service";
import { ClientRegistrationService } from "./client-registration.service";
import { OAuthMaintenanceService } from "./oauth-maintenance.service";
import { OAuthTokenService } from "./oauth-token.service";
import { OAuthPersistenceModule } from "./oauth-persistence.module";
import { OAUTH_NOW } from "./oauth-clock";
import { OAUTH_TOKEN_RESOLVER } from "./oauth-token-resolver";

@Module({
  imports: [OAuthPersistenceModule, UsersModule],
  providers: [
    { provide: OAUTH_NOW, useValue: () => new Date() },
    ClientRegistrationService,
    OAuthAuthorizationService,
    OAuthTokenService,
    OAuthMaintenanceService,
    { provide: OAUTH_TOKEN_RESOLVER, useExisting: OAuthTokenService },
  ],
  exports: [
    OAUTH_NOW,
    OAUTH_TOKEN_RESOLVER,
    OAuthAuthorizationService,
    ClientRegistrationService,
    OAuthTokenService,
    OAuthPersistenceModule,
  ],
})
export class OAuthModule {}
