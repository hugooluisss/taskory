import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { ErrorsFilter } from "./common/errors/errors.filter";

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
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
