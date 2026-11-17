import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { ErrorsFilter } from "./common/errors/errors.filter";

export const JSON_BODY_LIMIT = "256kb";

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
  (
    app as import("@nestjs/platform-express").NestExpressApplication
  ).useBodyParser("json", { limit: JSON_BODY_LIMIT });
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
