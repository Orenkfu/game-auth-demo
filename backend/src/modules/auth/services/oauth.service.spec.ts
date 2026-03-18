import { OAuthService } from './oauth.service';
import { IdentityService } from './identity.service';
import { OAuthAccountService } from './oauth-account.service';
import { StateStoreService } from './state-store.service';
import { DiscordProvider } from '../providers/discord/discord.provider';
import { RiotProvider } from '../providers/riot/riot.provider';
import { UserProfileService } from '../../users/services/user-profile.service';
import { LinkRequiredException } from '../exceptions/link-required.exception';
import { OAuthProvider } from '../entities/oauth-account.entity';
import { IdentityStatus } from '../entities/identity.entity';
import type { Identity } from '../entities/identity.entity';
import type { UserProfile } from '../../users/entities/user-profile.entity';
import type { OAuthAccount } from '../entities/oauth-account.entity';
import type { DiscordUser } from '../providers/discord/discord.types';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeIdentity(overrides: Partial<Identity> = {}): Identity {
  const now = new Date();
  return {
    id: 'identity-1',
    email: 'test@example.com',
    emailVerified: true,
    passwordHash: null,
    status: IdentityStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date();
  return {
    id: 'profile-1',
    identityId: 'identity-1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    gamerTag: null,
    preferredGames: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeOAuthAccount(overrides: Partial<OAuthAccount> = {}): OAuthAccount {
  const now = new Date();
  return {
    id: 'account-1',
    identityId: 'identity-1',
    provider: OAuthProvider.DISCORD,
    providerUserId: 'discord-123',
    providerUsername: 'testuser',
    providerEmail: 'test@example.com',
    accessTokenEncrypted: 'token',
    refreshTokenEncrypted: 'refresh',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    scopes: ['identify', 'email'],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDiscordUser(overrides: Partial<DiscordUser> = {}): DiscordUser {
  return {
    id: 'discord-123',
    username: 'testuser',
    discriminator: '0',
    global_name: 'Test User',
    avatar: null,
    email: 'test@example.com',
    verified: true,
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockIdentityService = {
  findByIdOrThrow: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  updateLastLogin: jest.fn(),
} as unknown as IdentityService;

const mockOAuthAccountService = {
  findByProviderUserId: jest.fn(),
  findByIdentityId: jest.fn(),
  create: jest.fn(),
  updateTokens: jest.fn(),
  delete: jest.fn(),
} as unknown as OAuthAccountService;

const mockStateStore = {
  generate: jest.fn(),
  validateAndConsume: jest.fn(),
} as unknown as StateStoreService;

const mockDiscordProvider = {
  getAuthorizationUrl: jest.fn(),
  exchangeCode: jest.fn(),
  getUserInfo: jest.fn(),
} as unknown as DiscordProvider;

const mockRiotProvider = {
  generatePKCE: jest.fn(),
  getAuthorizationUrl: jest.fn(),
  exchangeCode: jest.fn(),
  getAccountInfo: jest.fn(),
} as unknown as RiotProvider;

const mockUserProfileService = {
  findByIdentityIdOrThrow: jest.fn(),
  generateUniqueUsername: jest.fn(),
  create: jest.fn(),
} as unknown as UserProfileService;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OAuthService', () => {
  let service: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthService(
      mockIdentityService,
      mockOAuthAccountService,
      mockStateStore,
      mockDiscordProvider,
      mockRiotProvider,
      mockUserProfileService,
    );
  });

  describe('getDiscordAuthUrl', () => {
    it('generates state and returns authorization URL', async () => {
      (mockStateStore.generate as jest.Mock).mockResolvedValue('state-uuid');
      (mockDiscordProvider.getAuthorizationUrl as jest.Mock).mockReturnValue(
        'https://discord.com/oauth2/authorize?state=state-uuid',
      );

      const url = await service.getDiscordAuthUrl();

      expect(mockStateStore.generate).toHaveBeenCalledWith(undefined);
      expect(mockDiscordProvider.getAuthorizationUrl).toHaveBeenCalledWith('state-uuid');
      expect(url).toContain('state=state-uuid');
    });

    it('passes linkToIdentityId through to state data', async () => {
      (mockStateStore.generate as jest.Mock).mockResolvedValue('state-uuid');
      (mockDiscordProvider.getAuthorizationUrl as jest.Mock).mockReturnValue('https://example.com');

      await service.getDiscordAuthUrl({ linkToIdentityId: 'identity-1' });

      expect(mockStateStore.generate).toHaveBeenCalledWith({ linkToIdentityId: 'identity-1' });
    });
  });

  describe('handleDiscordCallback — Rule 1 (returning user)', () => {
    it('returns existing identity and profile when OAuth account already exists', async () => {
      const identity = makeIdentity();
      const profile = makeProfile();
      const account = makeOAuthAccount();
      const discordUser = makeDiscordUser();
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({});
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(account);
      (mockOAuthAccountService.updateTokens as jest.Mock).mockResolvedValue(undefined);
      (mockIdentityService.findByIdOrThrow as jest.Mock).mockResolvedValue(identity);
      (mockIdentityService.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
      (mockUserProfileService.findByIdentityIdOrThrow as jest.Mock).mockResolvedValue(profile);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.isNewUser).toBe(false);
      expect(result.identity).toEqual(identity);
      expect(result.profile).toEqual(profile);
      expect(mockOAuthAccountService.updateTokens).toHaveBeenCalled();
      expect(mockIdentityService.updateLastLogin).toHaveBeenCalledWith(identity.id);
    });
  });

  describe('handleDiscordCallback — Rule 2 (new user)', () => {
    it('creates a new identity and profile when no existing account and no email collision', async () => {
      const identity = makeIdentity();
      const profile = makeProfile();
      const discordUser = makeDiscordUser({ email: null }); // no email → no collision check
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({});
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(null);
      (mockIdentityService.create as jest.Mock).mockResolvedValue(identity);
      (mockUserProfileService.generateUniqueUsername as jest.Mock).mockResolvedValue('testuser');
      (mockUserProfileService.create as jest.Mock).mockResolvedValue(profile);
      (mockOAuthAccountService.create as jest.Mock).mockResolvedValue(undefined);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.isNewUser).toBe(true);
      expect(mockIdentityService.create).toHaveBeenCalled();
      expect(mockUserProfileService.create).toHaveBeenCalled();
      expect(mockOAuthAccountService.create).toHaveBeenCalled();
    });

    it('creates new identity when verified email does not collide with existing', async () => {
      const identity = makeIdentity();
      const profile = makeProfile();
      const discordUser = makeDiscordUser({ email: 'new@example.com', verified: true });
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({});
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(null);
      (mockIdentityService.findByEmail as jest.Mock).mockResolvedValue(null); // no collision
      (mockIdentityService.create as jest.Mock).mockResolvedValue(identity);
      (mockUserProfileService.generateUniqueUsername as jest.Mock).mockResolvedValue('testuser');
      (mockUserProfileService.create as jest.Mock).mockResolvedValue(profile);
      (mockOAuthAccountService.create as jest.Mock).mockResolvedValue(undefined);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.isNewUser).toBe(true);
    });
  });

  describe('handleDiscordCallback — Rule 3 (email collision)', () => {
    it('throws LinkRequiredException when verified email matches an existing identity', async () => {
      const existingIdentity = makeIdentity();
      const discordUser = makeDiscordUser({ email: 'test@example.com', verified: true });
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({});
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(null);
      (mockIdentityService.findByEmail as jest.Mock).mockResolvedValue(existingIdentity);

      await expect(
        service.handleDiscordCallback('code', 'state'),
      ).rejects.toThrow(LinkRequiredException);
    });

    it('does NOT throw when email is unverified despite collision', async () => {
      const identity = makeIdentity();
      const profile = makeProfile();
      const discordUser = makeDiscordUser({ email: 'test@example.com', verified: false });
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({});
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(null);
      (mockIdentityService.create as jest.Mock).mockResolvedValue(identity);
      (mockUserProfileService.generateUniqueUsername as jest.Mock).mockResolvedValue('testuser');
      (mockUserProfileService.create as jest.Mock).mockResolvedValue(profile);
      (mockOAuthAccountService.create as jest.Mock).mockResolvedValue(undefined);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.isNewUser).toBe(true);
      expect(mockIdentityService.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('handleDiscordCallback — explicit link flow', () => {
    it('links Discord account to existing identity when linkToIdentityId is in state', async () => {
      const identity = makeIdentity();
      const profile = makeProfile();
      const discordUser = makeDiscordUser();
      const tokens = { access_token: 'at', refresh_token: 'rt', expires_in: 3600 };

      (mockStateStore.validateAndConsume as jest.Mock).mockResolvedValue({
        linkToIdentityId: 'identity-1',
      });
      (mockDiscordProvider.exchangeCode as jest.Mock).mockResolvedValue(tokens);
      (mockDiscordProvider.getUserInfo as jest.Mock).mockResolvedValue(discordUser);
      (mockOAuthAccountService.findByProviderUserId as jest.Mock).mockResolvedValue(null);
      (mockIdentityService.findByIdOrThrow as jest.Mock).mockResolvedValue(identity);
      (mockOAuthAccountService.create as jest.Mock).mockResolvedValue(undefined);
      (mockUserProfileService.findByIdentityIdOrThrow as jest.Mock).mockResolvedValue(profile);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.isNewUser).toBe(false);
      expect(result.identity).toEqual(identity);
      expect(mockOAuthAccountService.create).toHaveBeenCalled();
      expect(mockIdentityService.create).not.toHaveBeenCalled();
    });
  });
});
