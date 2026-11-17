import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ConnectedAppsService } from "./connected-apps.service";
import { AuthGuard } from "../auth/guards/auth.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { AuthUser } from "../common/auth/auth-user";

@Controller("connected-apps")
@UseGuards(AuthGuard)
export class ConnectedAppsController {
  constructor(private readonly apps: ConnectedAppsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.apps.list(user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.apps.revoke(user.id, id);
  }
}
