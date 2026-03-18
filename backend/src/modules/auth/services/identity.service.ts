import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityRepository } from '../repositories/identity.repository';
import { Identity, IdentityStatus } from '../entities/identity.entity';
import { ERROR_IDENTITY_NOT_FOUND } from '../../../shared/constants';

export interface CreateIdentityDto {
  email: string;
  passwordHash?: string;
  emailVerified?: boolean;
}

@Injectable()
export class IdentityService {
  constructor(private readonly identityRepository: IdentityRepository) {}

  async create(dto: CreateIdentityDto): Promise<Identity> {
    const id = crypto.randomUUID();
    const now = new Date();

    const identity: Identity = {
      id,
      email: dto.email.toLowerCase(),
      emailVerified: dto.emailVerified ?? false,
      passwordHash: dto.passwordHash ?? null,
      status: IdentityStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    return await this.identityRepository.create(identity);
  }

  async findById(id: string): Promise<Identity | null> {
    return await this.identityRepository.findActiveById(id);
  }

  async findByIdOrThrow(id: string): Promise<Identity> {
    const identity = await this.findById(id);
    if (!identity) {
      throw new NotFoundException(ERROR_IDENTITY_NOT_FOUND);
    }
    return identity;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    return await this.identityRepository.findByEmail(email);
  }

  async updateLastLogin(id: string): Promise<void> {
    const identity = await this.findByIdOrThrow(id);
    identity.lastLoginAt = new Date();
    identity.updatedAt = new Date();
    await this.identityRepository.update(id, identity);
  }

  async setEmailVerified(id: string, verified: boolean): Promise<void> {
    const identity = await this.findByIdOrThrow(id);
    identity.emailVerified = verified;
    identity.updatedAt = new Date();
    await this.identityRepository.update(id, identity);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    const identity = await this.findByIdOrThrow(id);
    identity.passwordHash = passwordHash;
    identity.updatedAt = new Date();
    await this.identityRepository.update(id, identity);
  }

  async softDelete(id: string): Promise<void> {
    const identity = await this.findByIdOrThrow(id);
    identity.status = IdentityStatus.DELETED;
    identity.deletedAt = new Date();
    identity.updatedAt = new Date();
    await this.identityRepository.update(id, identity);
  }
}
