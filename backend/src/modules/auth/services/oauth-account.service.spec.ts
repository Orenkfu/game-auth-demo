import { Test, TestingModule } from '@nestjs/testing';
import { OAuthAccountService } from './oauth-account.service';
import { OAuthAccountRepository } from '../repositories/oauth-account.repository';
import { OAuthProvider } from '../entities/oauth-account.entity';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { TokenEncryptionService } from '../../../shared/services/token-encryption.service';

describe('OAuthAccountService', () => {
  let service: OAuthAccountService;

  beforeEach(async () => {
    const store = new InMemoryStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthAccountService,
        OAuthAccountRepository,
        {
          provide: InMemoryStore,
          useValue: store,
        },
        {
          provide: TokenEncryptionService,
          useValue: {
            encrypt: (plaintext: string) => `enc:${plaintext}`,
            decrypt: (stored: string) => stored.replace(/^enc:/, ''),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthAccountService>(OAuthAccountService);
  });

  describe('create', () => {
    it('should create OAuth account', async () => {
      const account = await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'testuser',
        providerEmail: 'test@example.com',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        scopes: ['identify', 'email'],
        metadata: { avatar: 'abc123' },
      });

      expect(account.id).toBeDefined();
      expect(account.identityId).toBe('identity-1');
      expect(account.provider).toBe(OAuthProvider.DISCORD);
      expect(account.providerUserId).toBe('discord-123');
      expect(account.scopes).toContain('identify');
    });

    it('should set token expiry', async () => {
      const account = await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: null,
        providerEmail: null,
        accessToken: 'access-token',
        refreshToken: null,
        expiresIn: 3600,
        scopes: [],
        metadata: {},
      });

      expect(account.tokenExpiresAt).not.toBeNull();
    });
  });

  describe('findByProviderUserId', () => {
    it('should find account by provider user ID', async () => {
      await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'testuser',
        providerEmail: null,
        accessToken: 'token',
        refreshToken: null,
        expiresIn: 3600,
        scopes: [],
        metadata: {},
      });

      const found = await service.findByProviderUserId(
        OAuthProvider.DISCORD,
        'discord-123',
      );

      expect(found).not.toBeNull();
      expect(found!.providerUserId).toBe('discord-123');
    });

    it('should return null for non-existent account', async () => {
      const found = await service.findByProviderUserId(
        OAuthProvider.DISCORD,
        'nonexistent',
      );

      expect(found).toBeNull();
    });
  });

  describe('findByIdentityId', () => {
    it('should find all accounts for identity', async () => {
      await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'testuser',
        providerEmail: null,
        accessToken: 'token',
        refreshToken: null,
        expiresIn: 3600,
        scopes: [],
        metadata: {},
      });

      await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.RIOT,
        providerUserId: 'riot-456',
        providerUsername: 'riotuser',
        providerEmail: null,
        accessToken: 'token',
        refreshToken: null,
        expiresIn: 3600,
        scopes: [],
        metadata: {},
      });

      const accounts = await service.findByIdentityId('identity-1');
      expect(accounts).toHaveLength(2);
    });

    it('should return empty array for identity without accounts', async () => {
      const accounts = await service.findByIdentityId('nonexistent');
      expect(accounts).toHaveLength(0);
    });
  });

  describe('updateTokens', () => {
    it('should update tokens', async () => {
      const account = await service.create({
        identityId: 'identity-1',
        provider: OAuthProvider.DISCORD,
        providerUserId: 'discord-123',
        providerUsername: 'testuser',
        providerEmail: null,
        accessToken: 'old-token',
        refreshToken: 'old-refresh',
        expiresIn: 3600,
        scopes: [],
        metadata: {},
      });

      await service.updateTokens(account.id, 'new-token', 'new-refresh', 7200);

      const updated = await service.findByProviderUserId(
        OAuthProvider.DISCORD,
        'discord-123',
      );

      expect(updated!.accessTokenEncrypted).toBe('enc:new-token');
      expect(updated!.refreshTokenEncrypted).toBe('enc:new-refresh');
    });
  });
});