import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysCoreModule } from "./api-keys-core.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ApiKeysCoreModule, AuthModule],
  controllers: [ApiKeysController],
})
export class ApiKeysModule {}
