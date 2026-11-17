import { Inject, Injectable } from "@nestjs/common";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { OAUTH_NOW, OAuthNow } from "../oauth/oauth-clock";
import { OAuthAuthorizationsRepository } from "../oauth/oauth-authorizations.repository";

@Injectable()
export class ConnectedAppsService {
  constructor(
    private readonly authorizations: OAuthAuthorizationsRepository,
    @Inject(OAUTH_NOW) private readonly now: OAuthNow,
  ) {}

  async list(userId: string): Promise<
    {
      id: string;
      clientName: string;
      createdAt: Date;
      lastUsedAt: Date | null;
    }[]
  > {
    const rows = await this.authorizations.listActive(userId);
    return rows.map((authorization) => ({
      id: authorization.id,
      clientName: authorization.client!.name,
      createdAt: authorization.createdAt,
      lastUsedAt: authorization.lastUsedAt,
    }));
  }

  async revoke(userId: string, id: string): Promise<void> {
    const revoked = await this.authorizations.revokeAuthorization(
      userId,
      id,
      this.now(),
    );
    if (!revoked) throw new ApiException(404, ERROR_CODES.NOT_FOUND);
  }
}
