import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import {
  OAUTH_PURGE_INTERVAL_MS,
  OAUTH_DEAD_AUTHORIZATION_RETENTION_MS,
  OAUTH_UNUSED_CLIENT_RETENTION_MS,
} from "./constants";
import { OAuthNow, OAUTH_NOW } from "./oauth-clock";
import { OAuthTokensRepository } from "./oauth-tokens.repository";

@Injectable()
export class OAuthMaintenanceService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OAuthMaintenanceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly tokens: OAuthTokensRepository,
    @Inject(OAUTH_NOW) private readonly now: OAuthNow,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runPurge();
    this.timer = setInterval(
      () => void this.runPurge(),
      OAUTH_PURGE_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runPurge(): Promise<void> {
    const now = this.now();
    try {
      await this.tokens.purgeExpired(
        now,
        new Date(now.getTime() - OAUTH_UNUSED_CLIENT_RETENTION_MS),
        new Date(now.getTime() - OAUTH_DEAD_AUTHORIZATION_RETENTION_MS),
      );
    } catch (error) {
      this.logger.error("OAuth retention purge failed.", error);
    }
  }
}
