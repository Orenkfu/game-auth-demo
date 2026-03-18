import { Module } from '@nestjs/common';
import { UserProfileService } from './services/user-profile.service';
import { UserProfileRepository } from './repositories/user-profile.repository';

@Module({
  providers: [UserProfileRepository, UserProfileService],
  exports: [UserProfileService, UserProfileRepository],
})
export class UsersModule {}
