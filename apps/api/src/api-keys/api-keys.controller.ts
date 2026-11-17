import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthRequest } from "../common/auth/auth-request";

@Controller("api-keys")
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@Req() request: AuthRequest) {
    return this.keys.list(request.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: AuthRequest, @Body() body: CreateApiKeyDto) {
    return this.keys.create(request.user.id, body.name);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.keys.revoke(request.user.id, id);
  }
}
