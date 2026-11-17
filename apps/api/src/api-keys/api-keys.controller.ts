import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { AuthUser } from "../common/auth/auth-user";

@Controller("api-keys")
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.keys.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateApiKeyDto) {
    return this.keys.create(user.id, body.name);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.keys.revoke(user.id, id);
  }
}
