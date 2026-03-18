import { IdentityRepository } from './identity.repository';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { Identity, IdentityStatus } from '../entities/identity.entity';

describe('IdentityRepository', () => {
  let repository: IdentityRepository;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    repository = new IdentityRepository(store);
  });

  describe('create', () => {
    it('should create and retrieve an identity', async () => {
      const identity: Identity = {
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await repository.create(identity);
      const retrieved = await repository.findById('1');

      expect(retrieved).toEqual(identity);
    });
  });

  describe('findByEmail', () => {
    beforeEach(async () => {
      await repository.create({
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    });

    it('should find identity by email (case-insensitive)', async () => {
      const found = await repository.findByEmail('JOHN@EXAMPLE.COM');
      expect(found?.id).toBe('1');
    });

    it('should return null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });

    it('should not find soft-deleted identities', async () => {
      const deleted = await repository.findById('1');
      if (deleted) {
        deleted.deletedAt = new Date();
        await repository.update('1', deleted);
      }

      const found = await repository.findByEmail('john@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByEmailOrThrow', () => {
    it('should throw for non-existent email', async () => {
      await expect(repository.findByEmailOrThrow('nonexistent@example.com')).rejects.toThrow(
        'Identity not found',
      );
    });
  });

  describe('findActiveById', () => {
    it('should find active (non-deleted) identity', async () => {
      const identity: Identity = {
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      await repository.create(identity);
      const found = await repository.findActiveById('1');

      expect(found).toEqual(identity);
    });

    it('should not find soft-deleted identity', async () => {
      const identity: Identity = {
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.DELETED,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      await repository.create(identity);
      const found = await repository.findActiveById('1');

      expect(found).toBeNull();
    });

    it('should return null for non-existent identity', async () => {
      const found = await repository.findActiveById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findAllActive', () => {
    it('should return only non-deleted identities', async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      await repository.create({
        id: '2',
        email: 'jane@example.com',
        emailVerified: true,
        passwordHash: 'hash456',
        status: IdentityStatus.DELETED,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      });

      const active = await repository.findAllActive();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('1');
    });
  });

  describe('findAllIncludingDeleted', () => {
    it('should return all identities including soft-deleted ones', async () => {
      const now = new Date();

      await repository.create({
        id: '1',
        email: 'john@example.com',
        emailVerified: true,
        passwordHash: 'hash123',
        status: IdentityStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      await repository.create({
        id: '2',
        email: 'jane@example.com',
        emailVerified: true,
        passwordHash: 'hash456',
        status: IdentityStatus.DELETED,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      });

      const all = await repository.findAllIncludingDeleted();

      expect(all).toHaveLength(2);
    });
  });
});
