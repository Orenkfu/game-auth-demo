import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import { UserProfile } from '../entities/user-profile.entity';
import { STORAGE_USER_PROFILES } from '../../../shared/constants';

/**
 * Repository for UserProfile entities.
 * Provides domain-specific operations for user profile persistence.
 */
@Injectable()
export class UserProfileRepository extends BaseRepository<UserProfile> {
  protected readonly namespace = STORAGE_USER_PROFILES;

  constructor(store: InMemoryStore) {
    super(store);
  }

  /**
   * Find user profile by identity ID.
   */
  async findByIdentityId(identityId: string): Promise<UserProfile | null> {
    return this.find((profile) => profile.identityId === identityId);
  }

  /**
   * Find user profile by identity ID or throw.
   */
  async findByIdentityIdOrThrow(identityId: string): Promise<UserProfile> {
    const profile = await this.findByIdentityId(identityId);
    if (!profile) {
      throw new Error('User profile not found');
    }
    return profile;
  }

  /**
   * Find user profile by username (case-sensitive).
   */
  async findByUsername(username: string): Promise<UserProfile | null> {
    return this.find((profile) => profile.username === username);
  }

  /**
   * Check if username exists.
   */
  async existsByUsername(username: string): Promise<boolean> {
    const profile = await this.findByUsername(username);
    return profile !== null;
  }

  /**
   * Find all profiles with a given display name.
   */
  async findByDisplayName(displayName: string): Promise<UserProfile[]> {
    return this.filter((profile) => profile.displayName === displayName);
  }

  /**
   * Find active (non-deleted) user profiles.
   */
  async findAllActive(): Promise<UserProfile[]> {
    return this.findAll();
  }

  /**
   * Count total user profiles.
   */
  async count(): Promise<number> {
    const profiles = await this.findAll();
    return profiles.length;
  }

  /**
   * Find profiles created after a certain date.
   */
  async findCreatedAfter(date: Date): Promise<UserProfile[]> {
    return this.filter((profile) => profile.createdAt > date);
  }

  /**
   * Find profiles updated within a date range.
   */
  async findUpdatedBetween(startDate: Date, endDate: Date): Promise<UserProfile[]> {
    return this.filter(
      (profile) => profile.updatedAt >= startDate && profile.updatedAt <= endDate,
    );
  }
}
