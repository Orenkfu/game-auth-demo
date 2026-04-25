import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

const MAX_CONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    if (this.configService.get('USE_POSTGRES') !== 'true') {
      return;
    }

    let attempt = 0;
    let delay = INITIAL_BACKOFF_MS;
    while (attempt < MAX_CONNECT_ATTEMPTS) {
      attempt += 1;
      try {
        await this.$connect();
        this.logger.log(`Connected to Postgres on attempt ${attempt}`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt >= MAX_CONNECT_ATTEMPTS) {
          this.logger.error(
            `Failed to connect to Postgres after ${attempt} attempts: ${message}`,
          );
          throw err;
        }
        this.logger.warn(
          `Postgres connect attempt ${attempt} failed (${message}); retrying in ${delay}ms`,
        );
        await sleep(delay);
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
