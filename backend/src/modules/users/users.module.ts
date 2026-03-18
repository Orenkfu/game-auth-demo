import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserProfileService } from './services/user-profile.service';
import { UserProfileRepository } from './repositories/user-profile.repository';
import { PrismaUserProfileRepository } from './repositories/prisma-user-profile.repository';
import { InMemoryStore } from '../../shared/services/in-memory-store.service';
import { PrismaService } from '../../shared/services/prisma.service';

@Module({
  providers: [
    {
      provide: UserProfileRepository,
      useFactory: (config: ConfigService, store: InMemoryStore, prisma: PrismaService) =>
        config.get('USE_POSTGRES') === 'true'
          ? new PrismaUserProfileRepository(prisma)
          : new UserProfileRepository(store),
      inject: [ConfigService, InMemoryStore, PrismaService],
    },
    UserProfileService,
  ],
  exports: [UserProfileService, UserProfileRepository],
})
export class UsersModule {}
