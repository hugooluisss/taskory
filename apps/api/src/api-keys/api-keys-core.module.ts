import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKey } from "./entities/api-key.entity";
import { ApiKeysRepository } from "./api-keys.repository";
import { ApiKeysService } from "./api-keys.service";
import { UsersModule } from "../users/users.module";
import { DatabaseModule } from "../common/database/database.module";

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), UsersModule, DatabaseModule],
  providers: [ApiKeysRepository, ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysCoreModule {}
