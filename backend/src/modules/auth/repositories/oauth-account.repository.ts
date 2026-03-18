import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import { OAuthAccount, OAuthProvider } from '../entities/oauth-account.entity';
import { STORAGE_OAUTH_ACCOUNTS } from '../../../shared/constants';

/**
 * Repository for OAuthAccount entities.
 * Provides domain-specific operations for OAuth account persistence.
 */
@Injectable()
export class OAuthAccountRepository extends BaseRepository<OAuthAccount> {
  protected readonly namespace = STORAGE_OAUTH_ACCOUNTS;

  constructor(store: InMemoryStore) {
    super(store);
  }

  /**
   * Find OAuth account by provider and provider user ID.
   */
  async findByProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.find(
      (account) => account.provider === provider && account.providerUserId === providerUserId,
    );
  }

  /**
   * Find OAuth account by provider and provider user ID or throw.
   */
  async findByProviderUserIdOrThrow(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount> {
    const account = await this.findByProviderUserId(provider, providerUserId);
    if (!account) {
      throw new Error(`OAuth account not found: ${provider}#${providerUserId}`);
    }
    return account;
  }

  /**
   * Find all OAuth accounts linked to an identity.
   */
  async findByIdentityId(identityId: string): Promise<OAuthAccount[]> {
    return this.filter((account) => account.identityId === identityId);
  }

  /**
   * Find OAuth account by identity and provider.
   */
  async findByIdentityAndProvider(
    identityId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    return this.find(
      (account) => account.identityId === identityId && account.provider === provider,
    );
  }

  /**
   * Delete OAuth account by identity and provider.
   */
  async deleteByIdentityAndProvider(
    identityId: string,
    provider: OAuthProvider,
  ): Promise<boolean> {
    const account = await this.findByIdentityAndProvider(identityId, provider);
    if (!account) {
      return false;
    }
    return this.delete(account.id);
  }

  /**
   * Delete all OAuth accounts for an identity.
   */
  async deleteByIdentity(identityId: string): Promise<number> {
    const accounts = await this.findByIdentityId(identityId);
    let deleted = 0;
    for (const account of accounts) {
      if (await this.delete(account.id)) {
        deleted++;
      }
    }
    return deleted;
  }
}
