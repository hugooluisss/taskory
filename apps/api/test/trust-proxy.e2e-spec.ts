import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { configureHttp } from "../src/http-setup";

@Controller("rate-limit-probe")
class RateLimitProbeController {
  @Get()
  @UseGuards(ThrottlerGuard)
  get(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1 }])],
  controllers: [RateLimitProbeController],
})
class RateLimitProbeModule {}

describe("Trusted proxy rate-limit client IP", () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
  });

  async function startApp(hops: number): Promise<void> {
    process.env.TRUST_PROXY_HOPS = String(hops);
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  }

  it("uses X-Forwarded-For when one proxy hop is trusted", async () => {
    await startApp(1);
    const endpoint = () =>
      request(app.getHttpServer())
        .get("/api/v1/rate-limit-probe")
        .set("X-Forwarded-For", "203.0.113.10");

    await endpoint().expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/rate-limit-probe")
      .set("X-Forwarded-For", "203.0.113.11")
      .expect(200);
  });

  it("ignores X-Forwarded-For when no proxy hop is trusted", async () => {
    await startApp(0);
    const endpoint = (ip: string) =>
      request(app.getHttpServer())
        .get("/api/v1/rate-limit-probe")
        .set("X-Forwarded-For", ip);

    await endpoint("203.0.113.10").expect(200);
    await endpoint("203.0.113.11").expect(429);
  });
});
