import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, MoreThan, Repository } from "typeorm";
import { OAuthAuthorizationCode } from "./entities/oauth-authorization-code.entity";
import { translateConstraint } from "./oauth-persistence.error";

@Injectable()
export class OAuthAuthorizationCodesRepository {
  constructor(
    @InjectRepository(OAuthAuthorizationCode)
    private readonly codes: Repository<OAuthAuthorizationCode>,
  ) {}

  create(
    values: Pick<
      OAuthAuthorizationCode,
      | "authorizationId"
      | "codeHash"
      | "codeChallenge"
      | "redirectUri"
      | "expiresAt"
    >,
  ): Promise<OAuthAuthorizationCode> {
    return this.codes
      .save(this.codes.create({ ...values, usedAt: null }))
      .catch(translateConstraint);
  }

  findByHash(codeHash: string): Promise<OAuthAuthorizationCode | null> {
    return this.codes.findOne({ where: { codeHash } });
  }

  async consume(id: string, at: Date): Promise<boolean> {
    const result = await this.codes.update(
      { id, usedAt: IsNull() },
      { usedAt: at },
    );
    return result.affected === 1;
  }

  async consumeValid(id: string, at: Date): Promise<boolean> {
    const result = await this.codes.update(
      { id, usedAt: IsNull(), expiresAt: MoreThan(at) },
      { usedAt: at },
    );
    return result.affected === 1;
  }
}
