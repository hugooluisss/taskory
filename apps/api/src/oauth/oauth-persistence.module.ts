import { Module } from "@nestjs/common";
import { DatabaseModule } from "../common/database/database.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { OAuthAuthorizationRequest } from "./entities/oauth-authorization-request.entity";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthClient } from "./entities/oauth-client.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { OAuthAuthorizationCodesRepository } from "./oauth-authorization-codes.repository";
import { OAuthAuthorizationRequestsRepository } from "./oauth-authorization-requests.repository";
import { OAuthAuthorizationsRepository } from "./oauth-authorizations.repository";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { OAuthTokensRepository } from "./oauth-tokens.repository";

const repositories = [
  OAuthClientsRepository,
  OAuthAuthorizationRequestsRepository,
  OAuthAuthorizationsRepository,
  OAuthAuthorizationCodesRepository,
  OAuthTokensRepository,
];

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      OAuthClient,
      OAuthAuthorizationRequest,
      OAuthAuthorization,
      OAuthAuthorizationCode,
      OAuthToken,
    ]),
  ],
  providers: repositories,
  exports: repositories,
})
export class OAuthPersistenceModule {}
