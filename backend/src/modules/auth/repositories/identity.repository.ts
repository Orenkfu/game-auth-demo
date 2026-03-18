import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import { Identity } from '../entities/identity.entity';
import { STORAGE_IDENTITIES } from '../../../shared/constants';

/**
 * Repository for Identity entities.
 * Provides domain-specific operations for identity persistence.
 */
@Injectable()
export class IdentityRepository extends BaseRepository<Identity> {
  protected readonly namespace = STORAGE_IDENTITIES;

  constructor(store: InMemoryStore) {
    super(store);
  }

  /**
   * Find identity by email (case-insensitive).
   */
  async findByEmail(email: string): Promise<Identity | null> {
    const normalizedEmail = email.toLowerCase();
    return this.find((identity) => identity.email === normalizedEmail && !identity.deletedAt);
  }

  /**
   * Find identity by email or throw NotFoundException.
   */
  async findByEmailOrThrow(email: string): Promise<Identity> {
    const identity = await this.findByEmail(email);
    if (!identity) {
      throw new Error('Identity not found');
    }
    return identity;
  }

  /**
   * Find non-deleted identity by ID.
   */
  async findActiveById(id: string): Promise<Identity | null> {
    const identity = await this.findById(id);
    return identity && !identity.deletedAt ? identity : null;
  }

  /**
   * Find all non-deleted identities.
   */
  async findAllActive(): Promise<Identity[]> {
    return this.filter((identity) => !identity.deletedAt);
  }

  /**
   * Get all identities including soft-deleted ones.
   */
  async findAllIncludingDeleted(): Promise<Identity[]> {
    return this.findAll();
  }
}
