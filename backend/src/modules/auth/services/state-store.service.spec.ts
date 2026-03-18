import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { StateStoreService, OAuthStateData } from './state-store.service';
import { SESSION_STORE } from '../../../shared/interfaces/cache-store.interface';
import { InMemoryCache } from '../../../shared/services/in-memory-cache.service';

describe('StateStoreService', () => {
  let service: StateStoreService;
  let cache: InMemoryCache;

  beforeEach(async () => {
    cache = new InMemoryCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateStoreService,
        {
          provide: SESSION_STORE,
          useValue: cache,
        },
      ],
    }).compile();

    service = module.get<StateStoreService>(StateStoreService);
  });

  describe('generate', () => {
    it('should generate unique state string', async () => {
      const state1 = await service.generate();
      const state2 = await service.generate();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
    });

    it('should store state data', async () => {
      const data: OAuthStateData = {
        redirectUrl: 'https://example.com',
        linkToIdentityId: 'identity-1',
      };

      const state = await service.generate(data);

      const stored = await cache.get(`oauth_state:${state}`);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.redirectUrl).toBe('https://example.com');
      expect(parsed.linkToIdentityId).toBe('identity-1');
    });

    it('should store PKCE code verifier', async () => {
      const data: OAuthStateData = {
        codeVerifier: 'verifier123',
      };

      const state = await service.generate(data);
      const stored = await cache.get(`oauth_state:${state}`);
      const parsed = JSON.parse(stored!);

      expect(parsed.codeVerifier).toBe('verifier123');
    });
  });

  describe('validateAndConsume', () => {
    it('should return stored data and delete state', async () => {
      const data: OAuthStateData = {
        redirectUrl: 'https://example.com',
      };

      const state = await service.generate(data);
      const retrieved = await service.validateAndConsume(state);

      expect(retrieved.redirectUrl).toBe('https://example.com');

      // State should be consumed (deleted)
      const stored = await cache.get(`oauth_state:${state}`);
      expect(stored).toBeNull();
    });

    it('should throw UnauthorizedException for invalid state', async () => {
      await expect(service.validateAndConsume('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when state is reused', async () => {
      const state = await service.generate({});

      // First use should succeed
      await service.validateAndConsume(state);

      // Second use should fail
      await expect(service.validateAndConsume(state)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return empty object when no data stored', async () => {
      const state = await service.generate();
      const retrieved = await service.validateAndConsume(state);

      expect(retrieved).toEqual({});
    });
  });
});