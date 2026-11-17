import { Injectable } from "@nestjs/common";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { PublicUser } from "./public-user";
import { AuthService } from "./auth.service";

@Injectable()
export class TokenAuthService {
  constructor(
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  authenticate(token: string): Promise<PublicUser> {
    if (token.startsWith("tk_")) {
      return this.apiKeys.authenticate(token);
    }
    return this.auth.authenticate(token);
  }
}
