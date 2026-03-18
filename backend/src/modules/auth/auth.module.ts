import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    IdentityRepository,
    OAuthAccountRepository,
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
