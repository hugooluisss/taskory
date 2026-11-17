import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OAuthClient } from "./entities/oauth-client.entity";
import { translateConstraint } from "./oauth-persistence.error";

@Injectable()
export class OAuthClientsRepository {
  constructor(
    @InjectRepository(OAuthClient)
    private readonly clients: Repository<OAuthClient>,
  ) {}

  create(
    values: Pick<OAuthClient, "name" | "redirectUris">,
  ): Promise<OAuthClient> {
    return this.clients
      .save(this.clients.create(values))
      .catch(translateConstraint);
  }

  find(id: string): Promise<OAuthClient | null> {
    return this.clients.findOne({ where: { id } });
  }
}
