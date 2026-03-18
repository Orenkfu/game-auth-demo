import { UserProfileRepository } from './user-profile.repository';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';
import { UserProfile } from '../entities/user-profile.entity';

describe('UserProfileRepository', () => {
  let repository: UserProfileRepository;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    repository = new UserProfileRepository(store);
  });

  describe('findByIdentityId', () => {
    beforeEach(async () => {
      const profile: UserProfile = {
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'johndoe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'A developer',
        gamerTag: 'JohnGamer',
        preferredGames: ['game1', 'game2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(profile);
    });

    it('should find user profile by identity ID', async () => {
      const found = await repository.findByIdentityId('identity-1');

      expect(found?.id).toBe('profile-1');
      expect(found?.username).toBe('johndoe');
    });

    it('should return null for non-existent identity', async () => {
      const found = await repository.findByIdentityId('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('findByIdentityIdOrThrow', () => {
    it('should throw for non-existent identity', async () => {
      await expect(repository.findByIdentityIdOrThrow('non-existent')).rejects.toThrow(
        'User profile not found',
      );
    });
  });

  describe('findByUsername', () => {
    beforeEach(async () => {
      const profile: UserProfile = {
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'johndoe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'A developer',
        gamerTag: 'JohnGamer',
        preferredGames: ['game1', 'game2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(profile);
    });

    it('should find user profile by username', async () => {
      const found = await repository.findByUsername('johndoe');

      expect(found?.id).toBe('profile-1');
      expect(found?.displayName).toBe('John Doe');
    });

    it('should return null for non-existent username', async () => {
      const found = await repository.findByUsername('nonexistent');

      expect(found).toBeNull();
    });

    it('should be case-sensitive', async () => {
      const found = await repository.findByUsername('JohnDoe');

      expect(found).toBeNull();
    });
  });

  describe('existsByUsername', () => {
    beforeEach(async () => {
      const profile: UserProfile = {
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'johndoe',
        displayName: 'John Doe',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.create(profile);
    });

    it('should return true if username exists', async () => {
      const exists = await repository.existsByUsername('johndoe');

      expect(exists).toBe(true);
    });

    it('should return false if username does not exist', async () => {
      const exists = await repository.existsByUsername('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('findByDisplayName', () => {
    beforeEach(async () => {
      const now = new Date();

      await repository.create({
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'johndoe',
        displayName: 'John Doe',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: 'profile-2',
        identityId: 'identity-2',
        username: 'janedoe',
        displayName: 'Jane Doe',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: 'profile-3',
        identityId: 'identity-3',
        username: 'johnsmith',
        displayName: 'John Doe',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    it('should find all profiles with given display name', async () => {
      const found = await repository.findByDisplayName('John Doe');

      expect(found).toHaveLength(2);
      expect(found.map((p) => p.username)).toContain('johndoe');
      expect(found.map((p) => p.username)).toContain('johnsmith');
    });

    it('should return empty array for non-existent display name', async () => {
      const found = await repository.findByDisplayName('NonExistent Name');

      expect(found).toEqual([]);
    });
  });

  describe('findAllActive', () => {
    it('should return all user profiles', async () => {
      const now = new Date();

      await repository.create({
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: now,
        updatedAt: now,
      });

      await repository.create({
        id: 'profile-2',
        identityId: 'identity-2',
        username: 'user2',
        displayName: 'User Two',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: now,
        updatedAt: now,
      });

      const all = await repository.findAllActive();

      expect(all).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('should return total count of user profiles', async () => {
      const now = new Date();

      for (let i = 1; i <= 5; i++) {
        await repository.create({
          id: `profile-${i}`,
          identityId: `identity-${i}`,
          username: `user${i}`,
          displayName: `User ${i}`,
          avatarUrl: null,
          bio: null,
          gamerTag: null,
          preferredGames: [],
          createdAt: now,
          updatedAt: now,
        });
      }

      const count = await repository.count();

      expect(count).toBe(5);
    });

    it('should return 0 for empty repository', async () => {
      const count = await repository.count();

      expect(count).toBe(0);
    });
  });

  describe('findCreatedAfter', () => {
    it('should find profiles created after a date', async () => {
      const beforeDate = new Date('2024-01-01');
      const middleDate = new Date('2024-01-10');
      const afterDate = new Date('2024-01-20');

      await repository.create({
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: beforeDate,
        updatedAt: beforeDate,
      });

      await repository.create({
        id: 'profile-2',
        identityId: 'identity-2',
        username: 'user2',
        displayName: 'User Two',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: afterDate,
        updatedAt: afterDate,
      });

      const found = await repository.findCreatedAfter(middleDate);

      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('profile-2');
    });

    it('should return empty array if no profiles created after date', async () => {
      const futureDate = new Date('2099-01-01');

      const found = await repository.findCreatedAfter(futureDate);

      expect(found).toEqual([]);
    });
  });

  describe('findUpdatedBetween', () => {
    it('should find profiles updated between dates', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-10');
      const date3 = new Date('2024-01-20');

      await repository.create({
        id: 'profile-1',
        identityId: 'identity-1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: date1,
        updatedAt: date1,
      });

      await repository.create({
        id: 'profile-2',
        identityId: 'identity-2',
        username: 'user2',
        displayName: 'User Two',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: date2,
        updatedAt: date2,
      });

      await repository.create({
        id: 'profile-3',
        identityId: 'identity-3',
        username: 'user3',
        displayName: 'User Three',
        avatarUrl: null,
        bio: null,
        gamerTag: null,
        preferredGames: [],
        createdAt: date3,
        updatedAt: date3,
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-15');

      const found = await repository.findUpdatedBetween(startDate, endDate);

      expect(found).toHaveLength(2);
      expect(found.map((p) => p.id)).toContain('profile-1');
      expect(found.map((p) => p.id)).toContain('profile-2');
    });
  });
});
