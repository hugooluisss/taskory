import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ApiKeysRepository } from "./api-keys.repository";
import { AuthUser } from "../common/auth/auth-user";
import { ApiException } from "../common/errors/api-exception";
import { ERROR_CODES } from "../common/errors/error-codes";
import { UsersService } from "../users/users.service";

export interface ListedApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export const MAX_ACTIVE_API_KEYS = 20;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly keys: ApiKeysRepository,
    private readonly users: UsersService,
  ) {}

  async create(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string; key: string }> {
    const key = `tk_${randomBytes(32).toString("base64url")}`;
    const record = await this.keys.createIfBelowLimit(
      {
        userId,
        name,
        prefix: key.slice(0, 11),
        keyHash: this.hash(key),
      },
      MAX_ACTIVE_API_KEYS,
    );
    if (!record) {
      throw new ApiException(409, ERROR_CODES.API_KEY_LIMIT);
    }
    return { id: record.id, name: record.name, key };
  }
  async list(userId: string): Promise<ListedApiKey[]> {
    const items = await this.keys.list(userId);
    return items.map(({ id, name, prefix, createdAt, lastUsedAt }) => ({
      id,
      name,
      prefix,
      createdAt,
      lastUsedAt,
    }));
  }

  async revoke(userId: string, id: string): Promise<void> {
    const revoked = await this.keys.revoke(userId, id, new Date());
    if (!revoked) {
      throw new ApiException(404, ERROR_CODES.NOT_FOUND);
    }
  }

  async authenticate(key: string): Promise<AuthUser> {
    const record = await this.keys.findActiveByHash(this.hash(key));
    if (!record) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    await this.keys.markUsed(record.id, new Date());
    const owner = await this.users.findById(record.userId);
    if (!owner) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    return {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      language: owner.language,
    };
  }

  private hash(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
}
