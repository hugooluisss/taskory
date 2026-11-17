import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, LessThanOrEqual, MoreThan, Repository } from "typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import { OAUTH_GRANT_MAX_LIFETIME_MS } from "./constants";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { OAuthAuthorizationRequest } from "./entities/oauth-authorization-request.entity";
import { OAuthClient } from "./entities/oauth-client.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { translateConstraint } from "./oauth-persistence.error";

@Injectable()
export class OAuthTokensRepository {
  constructor(
    @InjectRepository(OAuthToken)
    private readonly tokens: Repository<OAuthToken>,
    private readonly transactions: TransactionRunner,
  ) {}

  create(
    values: Pick<
      OAuthToken,
      | "authorizationId"
      | "kind"
      | "tokenHash"
      | "expiresAt"
      | "parentTokenId"
      | "codeId"
    >,
  ): Promise<OAuthToken> {
    return this.tokens
      .save(
        this.tokens.create({
          ...values,
          revokedAt: null,
          rotatedAt: null,
          lastUsedAt: null,
        }),
      )
      .catch(translateConstraint);
  }

  findByHash(tokenHash: string): Promise<OAuthToken | null> {
    return this.tokens.findOne({ where: { tokenHash } });
  }

  findWithAuthorizationByHash(tokenHash: string): Promise<OAuthToken | null> {
    return this.tokens.findOne({
      where: { tokenHash },
      relations: { authorization: true },
    });
  }

  findActiveAccessByHash(
    tokenHash: string,
    now: Date,
  ): Promise<OAuthToken | null> {
    return this.tokens
      .createQueryBuilder("token")
      .innerJoinAndSelect("token.authorization", "authorization")
      .where("token.tokenHash = :tokenHash", { tokenHash })
      .andWhere("token.kind = 'access'")
      .andWhere("token.expiresAt > :now", { now })
      .andWhere("token.revokedAt IS NULL")
      .andWhere("authorization.revokedAt IS NULL")
      .getOne();
  }

  async consumeRefresh(id: string, at: Date): Promise<boolean> {
    const result = await this.tokens.update(
      { id, kind: "refresh", rotatedAt: IsNull(), revokedAt: IsNull() },
      { rotatedAt: at, lastUsedAt: at },
    );
    return result.affected === 1;
  }

  async consumeActiveRefresh(id: string, at: Date): Promise<boolean> {
    const result = await this.tokens
      .createQueryBuilder()
      .update(OAuthToken)
      .set({ rotatedAt: at, lastUsedAt: at })
      .where("id = :id", { id })
      .andWhere("kind = 'refresh'")
      .andWhere("rotatedAt IS NULL")
      .andWhere("revokedAt IS NULL")
      .andWhere("expiresAt > :at", { at })
      .andWhere(
        "authorizationId IN (SELECT id FROM oauth_authorizations WHERE revokedAt IS NULL)",
      )
      .execute();
    return result.affected === 1;
  }

  async issueCodeTokens(
    codeId: string,
    at: Date,
    resource: string,
    values: Array<
      Pick<
        OAuthToken,
        | "authorizationId"
        | "kind"
        | "tokenHash"
        | "expiresAt"
        | "parentTokenId"
        | "codeId"
      >
    >,
  ): Promise<boolean> {
    return this.transactions
      .run(async (manager) => {
        const consumed = await manager
          .getRepository(OAuthAuthorizationCode)
          .createQueryBuilder()
          .update(OAuthAuthorizationCode)
          .set({ usedAt: at })
          .where("id = :codeId", { codeId })
          .andWhere("usedAt IS NULL")
          .andWhere("expiresAt > :at", { at })
          .andWhere(
            "EXISTS (SELECT 1 FROM oauth_authorizations a WHERE a.id = oauth_authorization_codes.authorizationId AND a.revokedAt IS NULL AND a.resource = :resource)",
            { resource },
          )
          .execute();
        if (consumed.affected !== 1) return false;
        const repository = manager.getRepository(OAuthToken);
        await repository.save(
          values.map((value) =>
            repository.create({
              ...value,
              revokedAt: null,
              rotatedAt: null,
              lastUsedAt: null,
            }),
          ),
        );
        return true;
      })
      .catch(translateConstraint);
  }

  async rotateRefreshTokens(
    oldId: string,
    values: Array<
      Pick<
        OAuthToken,
        | "authorizationId"
        | "kind"
        | "tokenHash"
        | "expiresAt"
        | "parentTokenId"
        | "codeId"
      >
    >,
    at: Date,
  ): Promise<boolean> {
    return this.transactions
      .run(async (manager) => {
        const consumed = await manager
          .getRepository(OAuthToken)
          .createQueryBuilder()
          .update(OAuthToken)
          .set({ rotatedAt: at, lastUsedAt: at })
          .where("id = :oldId", { oldId })
          .andWhere("kind = 'refresh'")
          .andWhere("rotatedAt IS NULL")
          .andWhere("revokedAt IS NULL")
          .andWhere("expiresAt > :at", { at })
          .andWhere(
            "authorizationId IN (SELECT id FROM oauth_authorizations WHERE revokedAt IS NULL)",
          )
          .execute();
        if (consumed.affected !== 1) return false;
        const repository = manager.getRepository(OAuthToken);
        await repository.save(
          values.map((value) =>
            repository.create({
              ...value,
              revokedAt: null,
              rotatedAt: null,
              lastUsedAt: null,
            }),
          ),
        );
        return true;
      })
      .catch(translateConstraint);
  }

  async touchLastUsed(
    tokenId: string,
    now: Date,
    notAfter: Date,
  ): Promise<boolean> {
    const result = await this.tokens
      .createQueryBuilder()
      .update(OAuthToken)
      .set({ lastUsedAt: now })
      .where("id = :tokenId", { tokenId })
      .andWhere("(lastUsedAt IS NULL OR lastUsedAt < :notAfter)", { notAfter })
      .execute();
    return result.affected === 1;
  }

  async revokeToken(tokenId: string, at: Date): Promise<boolean> {
    const result = await this.tokens.update(
      { id: tokenId, revokedAt: IsNull() },
      { revokedAt: at },
    );
    return result.affected === 1;
  }

  async markUsed(userId: string, id: string, at: Date): Promise<boolean> {
    const result = await this.tokens
      .createQueryBuilder()
      .update(OAuthToken)
      .set({ lastUsedAt: at })
      .where("id = :id", { id })
      .andWhere(
        "authorizationId IN (SELECT id FROM oauth_authorizations WHERE userId = :userId)",
        { userId },
      )
      .execute();
    return result.affected === 1;
  }

  async revokeTokensIssuedByCode(codeId: string, at: Date): Promise<number> {
    const result = await this.tokens.update(
      { codeId, revokedAt: IsNull() },
      { revokedAt: at },
    );
    return result.affected ?? 0;
  }

  async purgeExpired(
    now: Date,
    unusedClientBefore: Date,
    deadAuthorizationBefore: Date,
  ): Promise<{
    requests: number;
    codes: number;
    tokens: number;
    clients: number;
  }> {
    return this.transactions.run(async (manager) => {
      const dead = await manager
        .getRepository(OAuthAuthorization)
        .createQueryBuilder("authorization")
        .select("authorization.id", "id")
        .where(
          "(authorization.revokedAt IS NOT NULL AND authorization.revokedAt < :cutoff) OR (authorization.revokedAt IS NULL AND (COALESCE((SELECT MAX(t.expiresAt) FROM oauth_tokens t WHERE t.authorizationId = authorization.id), authorization.createdAt) < :cutoff OR authorization.createdAt < :grantLifetimeCutoff))",
          {
            cutoff: deadAuthorizationBefore,
            grantLifetimeCutoff: new Date(
              now.getTime() - OAUTH_GRANT_MAX_LIFETIME_MS,
            ),
          },
        )
        .getRawMany<{ id: string }>();
      const authorizationIds = dead.map(({ id }) => id);
      const tokens = authorizationIds.length
        ? await manager
            .getRepository(OAuthToken)
            .delete({ authorizationId: In(authorizationIds) })
        : { affected: 0 };
      const codes = authorizationIds.length
        ? await manager
            .getRepository(OAuthAuthorizationCode)
            .delete({ authorizationId: In(authorizationIds) })
        : { affected: 0 };
      if (authorizationIds.length) {
        await manager
          .getRepository(OAuthAuthorization)
          .delete({ id: In(authorizationIds) });
      }
      const requests = await manager
        .getRepository(OAuthAuthorizationRequest)
        .delete({ expiresAt: LessThanOrEqual(now) });
      const clients = await manager
        .getRepository(OAuthClient)
        .createQueryBuilder()
        .delete()
        .where("createdAt < :cutoff", { cutoff: unusedClientBefore })
        .andWhere(
          "NOT EXISTS (SELECT 1 FROM oauth_authorizations a WHERE a.clientId = oauth_clients.id)",
        )
        .andWhere(
          "NOT EXISTS (SELECT 1 FROM oauth_authorization_requests r WHERE r.clientId = oauth_clients.id AND r.decidedAt IS NULL AND r.expiresAt > :now)",
          { now },
        )
        .execute();
      return {
        requests: requests.affected ?? 0,
        codes: codes.affected ?? 0,
        tokens: tokens.affected ?? 0,
        clients: clients.affected ?? 0,
      };
    });
  }
}
