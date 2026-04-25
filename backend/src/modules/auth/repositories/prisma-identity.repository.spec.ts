import { Prisma } from '@prisma/client';
import { PrismaIdentityRepository } from './prisma-identity.repository';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Identity, IdentityStatus } from '../entities/identity.entity';

const mockPrisma = {
  identity: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaService;

function makeIdentity(overrides: Partial<Identity> = {}): Identity {
  const now = new Date();
  return {
    id: 'identity-1',
    email: 'test@example.com',
    emailVerified: false,
    passwordHash: null,
    status: IdentityStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe('PrismaIdentityRepository', () => {
  let repo: PrismaIdentityRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaIdentityRepository(mockPrisma);
  });

  it('creates an identity', async () => {
    const identity = makeIdentity();
    (mockPrisma.identity.create as jest.Mock).mockResolvedValue(identity);

    const result = await repo.create(identity);

    expect(mockPrisma.identity.create).toHaveBeenCalledWith({ data: identity });
    expect(result).toEqual(identity);
  });

  it('finds an identity by id', async () => {
    const identity = makeIdentity();
    (mockPrisma.identity.findUnique as jest.Mock).mockResolvedValue(identity);

    const result = await repo.findById('identity-1');

    expect(mockPrisma.identity.findUnique).toHaveBeenCalledWith({ where: { id: 'identity-1' } });
    expect(result).toEqual(identity);
  });

  it('returns null when identity not found by id', async () => {
    (mockPrisma.identity.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await repo.findById('missing')).toBeNull();
  });

  it('finds active identity by id (excludes soft-deleted)', async () => {
    const identity = makeIdentity();
    (mockPrisma.identity.findFirst as jest.Mock).mockResolvedValue(identity);

    const result = await repo.findActiveById('identity-1');

    expect(mockPrisma.identity.findFirst).toHaveBeenCalledWith({
      where: { id: 'identity-1', deletedAt: null },
    });
    expect(result).toEqual(identity);
  });

  it('finds identity by email (case-insensitive)', async () => {
    const identity = makeIdentity({ email: 'test@example.com' });
    (mockPrisma.identity.findFirst as jest.Mock).mockResolvedValue(identity);

    await repo.findByEmail('TEST@EXAMPLE.COM');

    expect(mockPrisma.identity.findFirst).toHaveBeenCalledWith({
      where: { email: 'test@example.com', deletedAt: null },
    });
  });

  it('updates an identity', async () => {
    const identity = makeIdentity({ emailVerified: true });
    (mockPrisma.identity.update as jest.Mock).mockResolvedValue(identity);

    const result = await repo.update('identity-1', identity);

    expect(mockPrisma.identity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'identity-1' } }),
    );
    expect(result).toEqual(identity);
  });

  it('returns true when delete succeeds', async () => {
    (mockPrisma.identity.delete as jest.Mock).mockResolvedValue({});
    expect(await repo.delete('identity-1')).toBe(true);
  });

  it('returns false when delete fails (record not found)', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    (mockPrisma.identity.delete as jest.Mock).mockRejectedValue(err);
    expect(await repo.delete('missing')).toBe(false);
  });

  it('rethrows non-P2025 errors from delete', async () => {
    (mockPrisma.identity.delete as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(repo.delete('x')).rejects.toThrow('boom');
  });
});
