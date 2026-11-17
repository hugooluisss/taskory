import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TokenAuthService } from "../token-auth.service";
import { AuthRequest } from "../../common/auth/auth-request";
import { ApiException } from "../../common/errors/api-exception";
import { ERROR_CODES } from "../../common/errors/error-codes";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: TokenAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }

    request.user = await this.auth.authenticate(token);
    return true;
  }
}
