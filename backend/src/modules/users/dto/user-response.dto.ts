import { Exclude, Expose } from 'class-transformer';
import { UserStatus } from '../entities/user.entity';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  emailVerified: boolean;

  @Expose()
  username: string;

  @Expose()
  displayName: string | null;

  @Expose()
  avatarUrl: string | null;

  @Expose()
  bio: string | null;

  @Expose()
  gamerTag: string | null;

  @Expose()
  preferredGames: string[];

  @Expose()
  status: UserStatus;

  @Expose()
  lastLoginAt: Date | null;

  @Expose()
  createdAt: Date;

  // Explicitly exclude sensitive fields
  @Exclude()
  passwordHash: string | null;

  @Exclude()
  deletedAt: Date | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

// Minimal public profile for other users to see
@Exclude()
export class PublicUserResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  displayName: string | null;

  @Expose()
  avatarUrl: string | null;

  @Expose()
  bio: string | null;

  @Expose()
  gamerTag: string | null;

  @Expose()
  preferredGames: string[];

  constructor(partial: Partial<PublicUserResponseDto>) {
    Object.assign(this, partial);
  }
}
