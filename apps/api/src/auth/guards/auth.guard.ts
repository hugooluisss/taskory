import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TokenAuthService } from "../token-auth.service";
import { AuthRequest } from "../../common/auth/auth-request";
import { ApiException } from "../../common/errors/api-exception";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { JWT_ONLY } from "../jwt-only.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: TokenAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }
    const jwtOnly = this.reflector.getAllAndOverride<boolean>(JWT_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (jwtOnly && (token.startsWith("tk_") || token.startsWith("to_"))) {
      throw new ApiException(401, ERROR_CODES.UNAUTHORIZED);
    }

    request.user = await this.auth.authenticate(token);
    return true;
  }
}
