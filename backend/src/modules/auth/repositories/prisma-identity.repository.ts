import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Identity } from '../entities/identity.entity';

@Injectable()
export class PrismaIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: Identity): Promise<Identity> {
    const result = await this.prisma.identity.create({ data: entity });
    return result as unknown as Identity;
  }

  async findById(id: string): Promise<Identity | null> {
    const result = await this.prisma.identity.findUnique({ where: { id } });
    return result as unknown as Identity | null;
  }

  async findActiveById(id: string): Promise<Identity | null> {
    const result = await this.prisma.identity.findFirst({
      where: { id, deletedAt: null },
    });
    return result as unknown as Identity | null;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    const result = await this.prisma.identity.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    return result as unknown as Identity | null;
  }

  async findByEmailOrThrow(email: string): Promise<Identity> {
    const identity = await this.findByEmail(email);
    if (!identity) throw new Error('Identity not found');
    return identity;
  }

  async findAllActive(): Promise<Identity[]> {
    const results = await this.prisma.identity.findMany({
      where: { deletedAt: null },
    });
    return results as unknown as Identity[];
  }

  async findAllIncludingDeleted(): Promise<Identity[]> {
    const results = await this.prisma.identity.findMany();
    return results as unknown as Identity[];
  }

  async update(id: string, entity: Identity): Promise<Identity> {
    const result = await this.prisma.identity.update({
      where: { id },
      data: {
        email: entity.email,
        emailVerified: entity.emailVerified,
        passwordHash: entity.passwordHash,
        status: entity.status,
        lastLoginAt: entity.lastLoginAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
    });
    return result as unknown as Identity;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.identity.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
