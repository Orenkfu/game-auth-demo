import { Injectable, NotFoundException } from '@nestjs/common';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { UserProfile } from '../entities/user-profile.entity';
import {
  ERROR_USER_PROFILE_NOT_FOUND,
  USERNAME_INVALID_CHARS_REGEX,
  USERNAME_GENERATED_PREFIX,
} from '../../../shared/constants';

export interface CreateUserProfileDto {
  identityId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface UpdateUserProfileDto {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  gamerTag?: string;
  preferredGames?: string[];
}

@Injectable()
export class UserProfileService {
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async create(dto: CreateUserProfileDto): Promise<UserProfile> {
    const id = crypto.randomUUID();
    const now = new Date();

    const profile: UserProfile = {
      id,
      identityId: dto.identityId,
      username: dto.username,
      displayName: dto.displayName ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      bio: null,
      gamerTag: null,
      preferredGames: [],
      createdAt: now,
      updatedAt: now,
    };

    return await this.userProfileRepository.create(profile);
  }

  async findById(id: string): Promise<UserProfile | null> {
    return await this.userProfileRepository.findById(id);
  }

  async findByIdOrThrow(id: string): Promise<UserProfile> {
    const profile = await this.findById(id);
    if (!profile) {
      throw new NotFoundException(ERROR_USER_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  async findByIdentityId(identityId: string): Promise<UserProfile | null> {
    return await this.userProfileRepository.findByIdentityId(identityId);
  }

  async findByIdentityIdOrThrow(identityId: string): Promise<UserProfile> {
    const profile = await this.findByIdentityId(identityId);
    if (!profile) {
      throw new NotFoundException(ERROR_USER_PROFILE_NOT_FOUND);
    }
    return profile;
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    return await this.userProfileRepository.findByUsername(username);
  }

  async update(id: string, dto: UpdateUserProfileDto): Promise<UserProfile> {
    const profile = await this.findByIdOrThrow(id);

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.gamerTag !== undefined) profile.gamerTag = dto.gamerTag;
    if (dto.preferredGames !== undefined) profile.preferredGames = dto.preferredGames;

    profile.updatedAt = new Date();
    return await this.userProfileRepository.update(id, profile);
  }

  async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.replace(USERNAME_INVALID_CHARS_REGEX, '');
    if (username.length < 3) {
      username = `${USERNAME_GENERATED_PREFIX}${crypto.randomUUID().slice(-8)}`;
    }

    let finalUsername = username;
    let counter = 1;
    while (await this.userProfileRepository.findByUsername(finalUsername)) {
      finalUsername = `${username}${counter}`;
      counter++;
    }

    return finalUsername;
  }
}
