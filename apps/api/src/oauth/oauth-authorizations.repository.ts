import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { TransactionRunner } from "../common/database/transaction-runner";
import { OAuthAuthorization } from "./entities/oauth-authorization.entity";
import { OAuthToken } from "./entities/oauth-token.entity";
import { translateConstraint } from "./oauth-persistence.error";

@Injectable()
export class OAuthAuthorizationsRepository {
  constructor(
    @InjectRepository(OAuthAuthorization)
    private readonly authorizations: Repository<OAuthAuthorization>,
    private readonly transactions: TransactionRunner,
  ) {}

  create(
    values: Pick<OAuthAuthorization, "userId" | "clientId" | "resource">,
  ): Promise<OAuthAuthorization> {
    return this.authorizations
      .save(
        this.authorizations.create({
          ...values,
          lastUsedAt: null,
          revokedAt: null,
        }),
      )
      .catch(translateConstraint);
  }

  find(userId: string, id: string): Promise<OAuthAuthorization | null> {
    return this.authorizations.findOne({ where: { userId, id } });
  }

  findById(id: string): Promise<OAuthAuthorization | null> {
    return this.authorizations.findOne({ where: { id } });
  }

  listActive(userId: string): Promise<OAuthAuthorization[]> {
    return this.authorizations
      .createQueryBuilder("authorization")
      .innerJoinAndSelect("authorization.client", "client")
      .where("authorization.userId = :userId", { userId })
      .andWhere("authorization.revokedAt IS NULL")
      .orderBy("authorization.createdAt", "DESC")
      .getMany();
  }

  async touchLastUsed(
    authorizationId: string,
    now: Date,
    notAfter: Date,
  ): Promise<boolean> {
    const result = await this.authorizations
      .createQueryBuilder()
      .update(OAuthAuthorization)
      .set({ lastUsedAt: now })
      .where("id = :authorizationId", { authorizationId })
      .andWhere("revokedAt IS NULL")
      .andWhere("(lastUsedAt IS NULL OR lastUsedAt < :notAfter)", { notAfter })
      .execute();
    return result.affected === 1;
  }

  async revokeAuthorization(
    userId: string,
    authorizationId: string,
    at: Date,
  ): Promise<boolean> {
    return this.revoke(authorizationId, at, userId);
  }

  async revokeAuthorizationById(
    authorizationId: string,
    at: Date,
  ): Promise<boolean> {
    return this.revoke(authorizationId, at);
  }

  private async revoke(
    authorizationId: string,
    at: Date,
    userId?: string,
  ): Promise<boolean> {
    return this.transactions.run(async (manager) => {
      const where = userId
        ? { userId, id: authorizationId }
        : { id: authorizationId };
      const result = await manager
        .getRepository(OAuthAuthorization)
        .update(where, { revokedAt: at });
      if (result.affected !== 1) return false;
      await manager
        .getRepository(OAuthToken)
        .update({ authorizationId, revokedAt: IsNull() }, { revokedAt: at });
      return result.affected === 1;
    });
  }
}
