import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IdentityService } from './services/identity.service';
import { OAuthAccountService } from './services/oauth-account.service';
import { OAuthService } from './services/oauth.service';
import { SessionService } from './services/session.service';
import { StateStoreService } from './services/state-store.service';
import { DiscordProvider } from './providers/discord/discord.provider';
import { RiotProvider } from './providers/riot/riot.provider';
import { OAuthController } from './controllers/oauth.controller';
import { IdentityRepository } from './repositories/identity.repository';
import { OAuthAccountRepository } from './repositories/oauth-account.repository';
import { PrismaIdentityRepository } from './repositories/prisma-identity.repository';
import { PrismaOAuthAccountRepository } from './repositories/prisma-oauth-account.repository';
import { InMemoryStore } from '../../shared/services/in-memory-store.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { UsersModule } from '../users/users.module';
import discordConfig from '../../config/discord.config';
import riotConfig from '../../config/riot.config';

@Module({
  imports: [
    ConfigModule.forFeature(discordConfig),
    ConfigModule.forFeature(riotConfig),
    forwardRef(() => UsersModule),
  ],
  controllers: [OAuthController],
  providers: [
    {
      provide: IdentityRepository,
      useFactory: (config: ConfigService, store: InMemoryStore, prisma: PrismaService) =>
        config.get('USE_POSTGRES') === 'true'
          ? new PrismaIdentityRepository(prisma)
          : new IdentityRepository(store),
      inject: [ConfigService, InMemoryStore, PrismaService],
    },
    {
      provide: OAuthAccountRepository,
      useFactory: (config: ConfigService, store: InMemoryStore, prisma: PrismaService) =>
        config.get('USE_POSTGRES') === 'true'
          ? new PrismaOAuthAccountRepository(prisma)
          : new OAuthAccountRepository(store),
      inject: [ConfigService, InMemoryStore, PrismaService],
    },
    IdentityService,
    OAuthAccountService,
    OAuthService,
    SessionService,
    StateStoreService,
    DiscordProvider,
    RiotProvider,
  ],
  exports: [IdentityService, OAuthAccountService, SessionService, IdentityRepository, OAuthAccountRepository],
})
export class AuthModule {}
