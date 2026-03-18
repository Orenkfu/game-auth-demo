import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { SESSION_STORE } from '../../../shared/interfaces/cache-store.interface';
import { InMemoryCache } from '../../../shared/services/in-memory-cache.service';

describe('SessionService', () => {
  let service: SessionService;
  let cache: InMemoryCache;

  beforeEach(async () => {
    cache = new InMemoryCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SESSION_STORE,
          useValue: cache,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(3600), // 1 hour TTL
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('create', () => {
    it('should create a session with unique ID', async () => {
      const session = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      expect(session.id).toBeDefined();
      expect(session.identityId).toBe('identity-1');
      expect(session.profileId).toBe('profile-1');
      expect(session.provider).toBe('discord');
      expect(session.createdAt).toBeDefined();
      expect(session.lastActivityAt).toBeDefined();
    });

    it('should store session in cache', async () => {
      const session = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      const stored = await cache.get(`session:${session.id}`);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.identityId).toBe('identity-1');
    });
  });

  describe('get', () => {
    it('should retrieve existing session', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      const retrieved = await service.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.identityId).toBe('identity-1');
    });

    it('should return null for non-existent session', async () => {
      const session = await service.get('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate and refresh session TTL', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      const validated = await service.validate(created.id);
      expect(validated).not.toBeNull();
      expect(validated!.identityId).toBe('identity-1');
      expect(validated!.lastActivityAt).toBeGreaterThanOrEqual(created.lastActivityAt);
    });

    it('should return null for invalid session', async () => {
      const session = await service.validate('invalid');
      expect(session).toBeNull();
    });
  });

  describe('touch', () => {
    it('should update lastActivityAt', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      const originalActivity = created.lastActivityAt;
      await new Promise((r) => setTimeout(r, 10));

      const result = await service.touch(created.id);
      expect(result).toBe(true);

      const updated = await service.get(created.id);
      expect(updated!.lastActivityAt).toBeGreaterThan(originalActivity);
    });

    it('should return false for non-existent session', async () => {
      const result = await service.touch('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should delete session', async () => {
      const created = await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });

      await service.revoke(created.id);

      const session = await service.get(created.id);
      expect(session).toBeNull();
    });

    it('should not throw for non-existent session', async () => {
      await expect(service.revoke('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('revokeAllForIdentity', () => {
    it('should revoke all sessions for identity', async () => {
      await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'discord',
      });
      await service.create({
        identityId: 'identity-1',
        profileId: 'profile-1',
        provider: 'riot',
      });
      await service.create({
        identityId: 'identity-2',
        profileId: 'profile-2',
        provider: 'discord',
      });

      const count = await service.revokeAllForIdentity('identity-1');
      expect(count).toBe(2);
    });

    it('should return 0 when no sessions exist', async () => {
      const count = await service.revokeAllForIdentity('nonexistent');
      expect(count).toBe(0);
    });
  });
});