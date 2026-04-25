import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../../shared/services/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly indicatorService: HealthIndicatorService,
  ) {}

  async check(key: string) {
    const indicator = this.indicatorService.check(key);
    if (this.configService.get('USE_POSTGRES') !== 'true') {
      return indicator.up({ mode: 'disabled' });
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return indicator.down({ reason: message });
    }
  }
}
