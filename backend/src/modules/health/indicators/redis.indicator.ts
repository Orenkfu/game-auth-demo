import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly configService: ConfigService,
    private readonly indicatorService: HealthIndicatorService,
  ) {}

  async check(key: string) {
    const indicator = this.indicatorService.check(key);
    if (this.configService.get('USE_REDIS') !== 'true') {
      return indicator.up({ mode: 'disabled' });
    }

    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') {
        return indicator.down({ reason: `unexpected ping reply: ${pong}` });
      }
      return indicator.up();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return indicator.down({ reason: message });
    } finally {
      client.disconnect();
    }
  }
}
