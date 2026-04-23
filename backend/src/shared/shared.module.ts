import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InMemoryStore } from './services/in-memory-store.service';
import { InMemoryCache } from './services/in-memory-cache.service';
import { RedisCache } from './services/redis-cache.service';
import { PrismaService } from './services/prisma.service';
import { SessionGuard } from './guards/session.guard';
import { TokenEncryptionService } from './services/token-encryption.service';
import { SESSION_STORE } from './interfaces/cache-store.interface';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Mock PostgreSQL
    InMemoryStore,
    // In-memory cache (always available)
    InMemoryCache,
    // Session store - only connect to Redis if USE_REDIS=true
    {
      provide: SESSION_STORE,
      useFactory: (config: ConfigService, memory: InMemoryCache, redis: RedisCache) => {
        if (config.get('USE_REDIS') === 'true') {
          redis.init();
          return redis;
        }
        return memory;
      },
      inject: [ConfigService, InMemoryCache, RedisCache],
    },
    RedisCache,
    PrismaService,
    SessionGuard,
    TokenEncryptionService,
  ],
  exports: [InMemoryStore, PrismaService, SESSION_STORE, SessionGuard, TokenEncryptionService],
})
export class SharedModule {}
