import { Prisma } from '@prisma/client';
import { PrismaUserProfileRepository } from './prisma-user-profile.repository';
import { PrismaService } from '../../../shared/services/prisma.service';
import { UserProfile } from '../entities/user-profile.entity';

const mockPrisma = {
  userProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaService;

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

describe('PrismaUserProfileRepository', () => {
  let repo: PrismaUserProfileRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaUserProfileRepository(mockPrisma);
  });

  it('creates a user profile', async () => {
    const profile = makeProfile();
    (mockPrisma.userProfile.create as jest.Mock).mockResolvedValue(profile);

    const result = await repo.create(profile);

    expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({ data: profile });
    expect(result).toEqual(profile);
  });

  it('finds profile by id', async () => {
    const profile = makeProfile();
    (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(profile);

    const result = await repo.findById('profile-1');

    expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({ where: { id: 'profile-1' } });
    expect(result).toEqual(profile);
  });

  it('finds profile by identityId', async () => {
    const profile = makeProfile();
    (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(profile);

    const result = await repo.findByIdentityId('identity-1');

    expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { identityId: 'identity-1' },
    });
    expect(result).toEqual(profile);
  });

  it('finds profile by username', async () => {
    const profile = makeProfile();
    (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(profile);

    const result = await repo.findByUsername('testuser');

    expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });
    expect(result).toEqual(profile);
  });

  it('returns null when profile not found', async () => {
    (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findByUsername('nobody')).toBeNull();
  });

  it('updates a profile', async () => {
    const profile = makeProfile({ displayName: 'Updated Name' });
    (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(profile);

    const result = await repo.update('profile-1', profile);

    expect(mockPrisma.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1' } }),
    );
    expect(result).toEqual(profile);
  });

  it('returns true when delete succeeds', async () => {
    (mockPrisma.userProfile.delete as jest.Mock).mockResolvedValue({});
    expect(await repo.delete('profile-1')).toBe(true);
  });

  it('returns false when delete fails (record not found)', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    (mockPrisma.userProfile.delete as jest.Mock).mockRejectedValue(err);
    expect(await repo.delete('missing')).toBe(false);
  });

  it('rethrows non-P2025 errors from delete', async () => {
    (mockPrisma.userProfile.delete as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(repo.delete('x')).rejects.toThrow('boom');
  });
});
