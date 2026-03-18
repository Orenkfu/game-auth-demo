import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(async () => {
    const store = new InMemoryStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        UserProfileRepository,
        {
          provide: InMemoryStore,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  describe('create', () => {
    it('should create user profile', async () => {
      const profile = await service.create({
        identityId: 'identity-1',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(profile.id).toBeDefined();
      expect(profile.identityId).toBe('identity-1');
      expect(profile.username).toBe('testuser');
      expect(profile.displayName).toBe('Test User');
    });

    it('should create profile with minimal data', async () => {
      const profile = await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      expect(profile.displayName).toBeNull();
      expect(profile.avatarUrl).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find profile by ID', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      const found = await service.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByIdentityId', () => {
    it('should find profile by identity ID', async () => {
      await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      const found = await service.findByIdentityId('identity-1');
      expect(found).not.toBeNull();
      expect(found!.identityId).toBe('identity-1');
    });

    it('should return null for non-existent identity', async () => {
      const found = await service.findByIdentityId('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find profile by username', async () => {
      await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      const found = await service.findByUsername('testuser');
      expect(found).not.toBeNull();
      expect(found!.username).toBe('testuser');
    });

    it('should return null for non-existent username', async () => {
      const found = await service.findByUsername('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update profile', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      const updated = await service.update(created.id, {
        displayName: 'Updated Name',
        bio: 'Hello world',
      });

      expect(updated.displayName).toBe('Updated Name');
      expect(updated.bio).toBe('Hello world');
    });

    it('should throw NotFoundException for non-existent profile', async () => {
      await expect(
        service.update('nonexistent', { displayName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateUniqueUsername', () => {
    it('should return base username if available', async () => {
      const username = await service.generateUniqueUsername('newuser');
      expect(username).toBe('newuser');
    });

    it('should append number if username taken', async () => {
      await service.create({
        identityId: 'identity-1',
        username: 'testuser',
      });

      const username = await service.generateUniqueUsername('testuser');
      expect(username).toMatch(/^testuser\d+$/);
    });

    it('should handle special characters', async () => {
      const username = await service.generateUniqueUsername('test user!@#');
      expect(username).not.toContain(' ');
      expect(username).not.toContain('!');
    });

    it('should preserve username case', async () => {
      const username = await service.generateUniqueUsername('TestUser');
      expect(username).toBe('TestUser');
    });
  });
});