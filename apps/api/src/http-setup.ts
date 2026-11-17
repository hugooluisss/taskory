import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ErrorsFilter } from "./common/errors/errors.filter";
import { OAuthCorsMiddleware } from "./oauth/oauth-cors.middleware";
import { getTrustProxyHops } from "./config";
import { getMcpPath } from "./oauth/public-url";

export const JSON_BODY_LIMIT = "256kb";

export function configureHttp(app: INestApplication): void {
  (app as NestExpressApplication).set("trust proxy", getTrustProxyHops());
  app.setGlobalPrefix("api/v1", {
    exclude: [
      ".well-known/oauth-authorization-server",
      ".well-known/oauth-protected-resource",
      `.well-known/oauth-protected-resource${getMcpPath()}`,
      ".well-known/oauth-protected-resource/*",
      "oauth/authorize",
      "oauth/token",
      "oauth/register",
      "oauth/revoke",
    ],
  });
  (
    app as import("@nestjs/platform-express").NestExpressApplication
  ).useBodyParser("json", { limit: JSON_BODY_LIMIT });
  (
    app as import("@nestjs/platform-express").NestExpressApplication
  ).useBodyParser("urlencoded", {
    limit: JSON_BODY_LIMIT,
    extended: false,
  });
  const cors = new OAuthCorsMiddleware();
  app.use(cors.use.bind(cors));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: () =>
        new BadRequestException({ code: "VALIDATION_ERROR" }),
    }),
  );
  app.useGlobalFilters(new ErrorsFilter());
}
