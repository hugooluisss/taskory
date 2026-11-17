import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateConfig } from "./config";
import { configureHttp } from "./http-setup";

async function bootstrap(): Promise<void> {
  validateConfig();
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
