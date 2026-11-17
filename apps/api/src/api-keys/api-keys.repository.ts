import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { ApiKey } from "./entities/api-key.entity";

@Injectable()
export class ApiKeysRepository {
  private creationQueue: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(ApiKey) private readonly keys: Repository<ApiKey>,
    private readonly dataSource: DataSource,
  ) {}

  list(userId: string): Promise<ApiKey[]> {
    return this.keys.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  findActiveByHash(keyHash: string): Promise<ApiKey | null> {
    return this.keys.findOne({ where: { keyHash, revokedAt: IsNull() } });
  }

  createIfBelowLimit(
    values: Pick<ApiKey, "userId" | "name" | "prefix" | "keyHash">,
    limit: number,
  ): Promise<ApiKey | null> {
    const creation = this.creationQueue.then(() =>
      this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(ApiKey);
        const activeCount = await repository.count({
          where: { userId: values.userId, revokedAt: IsNull() },
        });
        if (activeCount >= limit) {
          return null;
        }
        return repository.save(repository.create(values));
      }),
    );
    this.creationQueue = creation.catch(() => undefined);
    return creation;
  }

  async markUsed(id: string, at: Date): Promise<void> {
    await this.keys.update({ id }, { lastUsedAt: at });
  }

  async revoke(userId: string, id: string, at: Date): Promise<boolean> {
    const result = await this.keys.update(
      { id, userId, revokedAt: IsNull() },
      { revokedAt: at },
    );
    return result.affected === 1;
  }
}
