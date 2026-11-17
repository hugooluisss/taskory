import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import { IsNull, MoreThan, Repository } from "typeorm";
import { OAuthAuthorizationRequest } from "./entities/oauth-authorization-request.entity";
import { translateConstraint } from "./oauth-persistence.error";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { OAuthRequestNotFoundError } from "./oauth-domain.error";

@Injectable()
export class OAuthAuthorizationRequestsRepository {
  constructor(
    @InjectRepository(OAuthAuthorizationRequest)
    private readonly requests: Repository<OAuthAuthorizationRequest>,
    private readonly transactions: TransactionRunner,
  ) {}

  create(
    values: Pick<
      OAuthAuthorizationRequest,
      "clientId" | "redirectUri" | "codeChallenge" | "state" | "expiresAt"
    >,
  ): Promise<OAuthAuthorizationRequest> {
    return this.requests
      .save(this.requests.create({ ...values, decidedAt: null }))
      .catch(translateConstraint);
  }

  find(id: string): Promise<OAuthAuthorizationRequest | null> {
    return this.requests.findOne({ where: { id } });
  }

  async approveRequest(
    requestId: string,
    userId: string,
    clientId: string,
    redirectUri: string,
    challenge: string,
    codeHash: string,
    now: Date,
    expiresAt: Date,
    resource: string,
  ): Promise<void> {
    return this.transactions
      .run(async (manager) => {
        const claimed = await manager
          .getRepository(OAuthAuthorizationRequest)
          .update(
            {
              id: requestId,
              clientId,
              decidedAt: IsNull(),
              expiresAt: MoreThan(now),
            },
            { decidedAt: now },
          );
        if (claimed.affected !== 1) {
          throw new OAuthRequestNotFoundError("already_decided");
        }
        const authorization = await manager
          .getRepository(OAuthAuthorization)
          .save(
            manager.getRepository(OAuthAuthorization).create({
              userId,
              clientId,
              resource,
              lastUsedAt: null,
              revokedAt: null,
            }),
          );
        const codeRepository = manager.getRepository(OAuthAuthorizationCode);
        await codeRepository.save(
          codeRepository.create({
            authorizationId: authorization.id,
            codeHash,
            codeChallenge: challenge,
            redirectUri,
            expiresAt,
            usedAt: null,
          }),
        );
      })
      .catch(translateConstraint);
  }

  async markDecidedBeforeExpiry(id: string, at: Date): Promise<boolean> {
    const result = await this.requests.update(
      { id, decidedAt: IsNull(), expiresAt: MoreThan(at) },
      { decidedAt: at },
    );
    return result.affected === 1;
  }

  async markDecided(id: string, at: Date): Promise<boolean> {
    const result = await this.requests.update(
      { id, decidedAt: IsNull() },
      { decidedAt: at },
    );
    return result.affected === 1;
  }
}
