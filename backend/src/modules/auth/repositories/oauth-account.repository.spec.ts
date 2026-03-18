import { OAuthAccountRepository } from './oauth-account.repository';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { OAuthAccount, OAuthProvider } from '../entities/oauth-account.entity';

describe('OAuthAccountRepository', () => {
  let repository: OAuthAccountRepository;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    repository = new OAuthAccountRepository(store);
  });

  describe('findByProviderUserId', () => {
    beforeEach(async () => {
      const account: OAuthAccount = {
        id: '1',
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'johndoe',
        providerEmail: 'john@discord.com',
        accessTokenEncrypted: 'token',
        refreshTokenEncrypted: 'refresh',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(account);
    });

    it('should find OAuth account by provider and user ID', async () => {
      const found = await repository.findByProviderUserId(OAuthProvider.DISCORD, 'discord-123');

      expect(found?.id).toBe('1');
      expect(found?.providerUsername).toBe('johndoe');
    });

    it('should return null for non-existent provider/user combo', async () => {
      const found = await repository.findByProviderUserId(OAuthProvider.RIOT, 'discord-123');

      expect(found).toBeNull();
    });
  });

  describe('findByProviderUserIdOrThrow', () => {
    it('should throw for non-existent account', async () => {
      await expect(
        repository.findByProviderUserIdOrThrow(OAuthProvider.DISCORD, 'non-existent'),
      ).rejects.toThrow('OAuth account not found');
    });
  });

  describe('findByIdentityId', () => {
    beforeEach(async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'johndoe',
        providerEmail: 'john@discord.com',
        accessTokenEncrypted: 'token',
        refreshTokenEncrypted: 'refresh',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: '2',
        identityId: 'identity-1',
        provider: OAuthProvider.RIOT,
        providerUserId: 'riot-456',
        providerUsername: 'janedoe#NA1',
        providerEmail: null,
        accessTokenEncrypted: 'token2',
        refreshTokenEncrypted: null,
        tokenExpiresAt: new Date(),
        scopes: ['openid', 'offline_access'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should find all OAuth accounts for an identity', async () => {
      const accounts = await repository.findByIdentityId('identity-1');

      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.provider)).toContain(OAuthProvider.DISCORD);
      expect(accounts.map((a) => a.provider)).toContain(OAuthProvider.RIOT);
    });

    it('should return empty array for identity with no accounts', async () => {
      const accounts = await repository.findByIdentityId('identity-2');

      expect(accounts).toEqual([]);
    });
  });

  describe('findByIdentityAndProvider', () => {
    beforeEach(async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'johndoe',
        providerEmail: 'john@discord.com',
        accessTokenEncrypted: 'token',
        refreshTokenEncrypted: 'refresh',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should find OAuth account by identity and provider', async () => {
      const found = await repository.findByIdentityAndProvider(
        'identity-1',
        OAuthProvider.DISCORD,
      );

      expect(found?.id).toBe('1');
    });

    it('should return null if combination not found', async () => {
      const found = await repository.findByIdentityAndProvider('identity-1', OAuthProvider.RIOT);

      expect(found).toBeNull();
    });
  });

  describe('deleteByIdentityAndProvider', () => {
    beforeEach(async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'johndoe',
        providerEmail: 'john@discord.com',
        accessTokenEncrypted: 'token',
        refreshTokenEncrypted: 'refresh',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: '2',
        identityId: 'identity-1',
        provider: OAuthProvider.RIOT,
        providerUserId: 'riot-456',
        providerUsername: 'janedoe#NA1',
        providerEmail: null,
        accessTokenEncrypted: 'token2',
        refreshTokenEncrypted: null,
        tokenExpiresAt: new Date(),
        scopes: ['openid', 'offline_access'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should delete OAuth account by identity and provider', async () => {
      const deleted = await repository.deleteByIdentityAndProvider(
        'identity-1',
        OAuthProvider.DISCORD,
      );

      expect(deleted).toBe(true);

      const remaining = await repository.findByIdentityId('identity-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].provider).toBe(OAuthProvider.RIOT);
    });

    it('should return false for non-existent combination', async () => {
      const deleted = await repository.deleteByIdentityAndProvider(
        'identity-2',
        OAuthProvider.DISCORD,
      );

      expect(deleted).toBe(false);
    });
  });

  describe('deleteByIdentity', () => {
    beforeEach(async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'johndoe',
        providerEmail: 'john@discord.com',
        accessTokenEncrypted: 'token',
        refreshTokenEncrypted: 'refresh',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: '2',
        identityId: 'identity-1',
        provider: OAuthProvider.RIOT,
        providerUserId: 'riot-456',
        providerUsername: 'janedoe#NA1',
        providerEmail: null,
        accessTokenEncrypted: 'token2',
        refreshTokenEncrypted: null,
        tokenExpiresAt: new Date(),
        scopes: ['openid', 'offline_access'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: '3',
        identityId: 'identity-2',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-789',
        providerUsername: 'bobsmith',
        providerEmail: 'bob@discord.com',
        accessTokenEncrypted: 'token3',
        refreshTokenEncrypted: 'refresh3',
        tokenExpiresAt: new Date(),
        scopes: ['identify', 'email'],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should delete all OAuth accounts for an identity', async () => {
      const deleted = await repository.deleteByIdentity('identity-1');

      expect(deleted).toBe(2);

      const remaining1 = await repository.findByIdentityId('identity-1');
      expect(remaining1).toHaveLength(0);

      const remaining2 = await repository.findByIdentityId('identity-2');
      expect(remaining2).toHaveLength(1);
    });

    it('should return 0 for identity with no accounts', async () => {
      const deleted = await repository.deleteByIdentity('identity-3');

      expect(deleted).toBe(0);
    });
  });
});
