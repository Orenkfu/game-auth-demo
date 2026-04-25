import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/services/prisma.service';
import { UserProfile } from '../entities/user-profile.entity';

const PRISMA_RECORD_NOT_FOUND = 'P2025';

@Injectable()
export class PrismaUserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: UserProfile): Promise<UserProfile> {
    const result = await this.prisma.userProfile.create({ data: entity });
    return result as unknown as UserProfile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    const result = await this.prisma.userProfile.findUnique({ where: { id } });
    return result as unknown as UserProfile | null;
  }

  async findByIdentityId(identityId: string): Promise<UserProfile | null> {
    const result = await this.prisma.userProfile.findUnique({
      where: { identityId },
    });
    return result as unknown as UserProfile | null;
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    const result = await this.prisma.userProfile.findUnique({
      where: { username },
    });
    return result as unknown as UserProfile | null;
  }

  async update(id: string, entity: UserProfile): Promise<UserProfile> {
    const result = await this.prisma.userProfile.update({
      where: { id },
      data: {
        username: entity.username,
        displayName: entity.displayName,
        avatarUrl: entity.avatarUrl,
        bio: entity.bio,
        gamerTag: entity.gamerTag,
        preferredGames: entity.preferredGames,
        updatedAt: entity.updatedAt,
      },
    });
    return result as unknown as UserProfile;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userProfile.delete({ where: { id } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === PRISMA_RECORD_NOT_FOUND
      ) {
        return false;
      }
      throw err;
    }
  }
}
