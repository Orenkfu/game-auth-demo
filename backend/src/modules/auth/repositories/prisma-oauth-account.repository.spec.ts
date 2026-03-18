import { PrismaOAuthAccountRepository } from './prisma-oauth-account.repository';
import { PrismaService } from '../../../shared/services/prisma.service';
import { OAuthAccount, OAuthProvider } from '../entities/oauth-account.entity';

const mockPrisma = {
  oAuthAccount: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
} as unknown as PrismaService;

function makeAccount(overrides: Partial<OAuthAccount> = {}): OAuthAccount {
  const now = new Date();
  return {
    id: 'account-1',
    identityId: 'identity-1',
    provider: OAuthProvider.DISCORD,
    providerUserId: 'discord-123',
    providerUsername: 'testuser',
    providerEmail: 'test@example.com',
    accessTokenEncrypted: 'access-token',
    refreshTokenEncrypted: 'refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    scopes: ['identify', 'email'],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PrismaOAuthAccountRepository', () => {
  let repo: PrismaOAuthAccountRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaOAuthAccountRepository(mockPrisma);
  });

  it('creates an oauth account', async () => {
    const account = makeAccount();
    (mockPrisma.oAuthAccount.create as jest.Mock).mockResolvedValue(account);

    const result = await repo.create(account);

    expect(mockPrisma.oAuthAccount.create).toHaveBeenCalled();
    expect(result).toEqual(account);
  });

  it('finds account by provider and providerUserId', async () => {
    const account = makeAccount();
    (mockPrisma.oAuthAccount.findUnique as jest.Mock).mockResolvedValue(account);

    const result = await repo.findByProviderUserId(OAuthProvider.DISCORD, 'discord-123');

    expect(mockPrisma.oAuthAccount.findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: OAuthProvider.DISCORD,
          providerUserId: 'discord-123',
        },
      },
    });
    expect(result).toEqual(account);
  });

  it('returns null when account not found by provider', async () => {
    (mockPrisma.oAuthAccount.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findByProviderUserId(OAuthProvider.DISCORD, 'missing')).toBeNull();
  });

  it('finds all accounts by identityId', async () => {
    const accounts = [makeAccount(), makeAccount({ id: 'account-2', provider: OAuthProvider.RIOT })];
    (mockPrisma.oAuthAccount.findMany as jest.Mock).mockResolvedValue(accounts);

    const result = await repo.findByIdentityId('identity-1');

    expect(mockPrisma.oAuthAccount.findMany).toHaveBeenCalledWith({
      where: { identityId: 'identity-1' },
    });
    expect(result).toHaveLength(2);
  });

  it('deletes by identity and provider, returns true when deleted', async () => {
    (mockPrisma.oAuthAccount.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await repo.deleteByIdentityAndProvider('identity-1', OAuthProvider.DISCORD);

    expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
      where: { identityId: 'identity-1', provider: OAuthProvider.DISCORD },
    });
    expect(result).toBe(true);
  });

  it('returns false when no accounts deleted', async () => {
    (mockPrisma.oAuthAccount.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    expect(await repo.deleteByIdentityAndProvider('identity-1', OAuthProvider.DISCORD)).toBe(false);
  });
});
