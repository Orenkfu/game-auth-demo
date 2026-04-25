import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import {
  HEALTH_CONTROLLER_ROUTE,
  HEALTH_LIVENESS_ROUTE,
  HEALTH_READINESS_ROUTE,
} from '../../shared/constants';
import { PrismaHealthIndicator } from './indicators/prisma.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';

@Controller({ path: HEALTH_CONTROLLER_ROUTE, version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get(HEALTH_LIVENESS_ROUTE)
  live() {
    return { status: 'ok' };
  }

  @Get(HEALTH_READINESS_ROUTE)
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prisma.check('postgres'),
      () => this.redis.check('redis'),
    ]);
  }
}
