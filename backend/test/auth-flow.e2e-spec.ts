import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DiscordProvider } from '../src/modules/auth/providers/discord/discord.provider';
import { RiotProvider } from '../src/modules/auth/providers/riot/riot.provider';
import { StateStoreService } from '../src/modules/auth/services/state-store.service';
import { RedisCache } from '../src/shared/services/redis-cache.service';
import { DiscordUser, DiscordTokenResponse } from '../src/modules/auth/providers/discord/discord.types';

const mockDiscord = {
  getAuthorizationUrl: jest.fn((state: string) => `https://discord.com/oauth2/authorize?state=${state}`),
  exchangeCode: jest.fn(),
  getUserInfo: jest.fn(),
  refreshTokens: jest.fn(),
  revokeToken: jest.fn(),
  getRelationships: jest.fn(),
};

const mockRiot = {
  getAuthorizationUrl: jest.fn(),
  exchangeCode: jest.fn(),
  getAccountInfo: jest.fn(),
  generatePKCE: jest.fn(() => ({ codeVerifier: 'verifier', codeChallenge: 'challenge' })),
};

function makeTokens(): DiscordTokenResponse {
  return {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    expires_in: 604800,
    token_type: 'Bearer',
    scope: 'identify email',
  };
}

function makeDiscordUser(id: string, username: string, email: string, verified = true): DiscordUser {
  return { id, username, discriminator: '0', global_name: username, avatar: null, email, verified };
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let stateStore: StateStoreService;
  let redisCache: RedisCache;

  beforeAll(async () => {
    process.env.USE_REDIS = 'true';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DiscordProvider)
      .useValue(mockDiscord)
      .overrideProvider(RiotProvider)
      .useValue(mockRiot)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    stateStore = moduleFixture.get<StateStoreService>(StateStoreService);
    redisCache = moduleFixture.get<RedisCache>(RedisCache);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Rule 2: First login ────────────────────────────────────────────────────

  describe('Rule 2 — first login creates a new identity', () => {
    it('returns isNewUser: true with a session token and persisted identity', async () => {
      const user = makeDiscordUser('d-001', 'alice', 'alice@example.com');
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(user);

      const state = await stateStore.generate();
      const res = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state}`)
        .expect(200);

      expect(res.body.isNewUser).toBe(true);
      expect(res.body.sessionToken).toBeDefined();
      expect(res.body.identity.email).toBe('alice@example.com');
      expect(res.body.profile.username).toBeDefined();
    });

    it('session token is valid immediately after login', async () => {
      const user = makeDiscordUser('d-001b', 'alice2', 'alice2@example.com');
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(user);

      const state = await stateStore.generate();
      const login = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state}`)
        .expect(200);

      const { sessionToken } = login.body;

      await request(app.getHttpServer())
        .get('/oauth/session')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200)
        .expect((res) => expect(res.body.valid).toBe(true));
    });
  });

  // ─── Rule 1: Returning user ─────────────────────────────────────────────────

  describe('Rule 1 — returning user logs in again', () => {
    it('returns isNewUser: false and the same identity id on second login', async () => {
      const user = makeDiscordUser('d-002', 'bob', 'bob@example.com');
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(user);

      const state1 = await stateStore.generate();
      const first = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state1}`)
        .expect(200);

      expect(first.body.isNewUser).toBe(true);

      // Same Discord user, new state token
      const state2 = await stateStore.generate();
      const second = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state2}`)
        .expect(200);

      expect(second.body.isNewUser).toBe(false);
      expect(second.body.identity.id).toBe(first.body.identity.id);
      expect(second.body.sessionToken).toBeDefined();
    });
  });

  // ─── Rule 3: Email collision ────────────────────────────────────────────────

  describe('Rule 3 — email collision with existing identity', () => {
    it('returns 409 LINK_REQUIRED when a different Discord account uses a taken verified email', async () => {
      const email = 'charlie@example.com';

      // Discord account A creates the identity
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(makeDiscordUser('d-003a', 'charlie', email));

      const state1 = await stateStore.generate();
      await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state1}`)
        .expect(200);

      // Discord account B with the same verified email → should be blocked
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(makeDiscordUser('d-003b', 'charlie2', email));

      const state2 = await stateStore.generate();
      const res = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state2}`)
        .expect(409);

      expect(res.body.error).toBe('LINK_REQUIRED');
    });

    it('succeeds when linkToIdentityId is present in state (explicit link flow)', async () => {
      const email = 'dave@example.com';

      // Discord account A creates the identity
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(makeDiscordUser('d-004a', 'dave', email));

      const state1 = await stateStore.generate();
      const first = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state1}`)
        .expect(200);

      const { id: identityId } = first.body.identity;

      // Discord account B explicitly linking to that identity
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(makeDiscordUser('d-004b', 'dave2', 'dave2@example.com'));

      const linkState = await stateStore.generate({ linkToIdentityId: identityId });
      const res = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${linkState}`)
        .expect(200);

      expect(res.body.isNewUser).toBe(false);
      expect(res.body.identity.id).toBe(identityId);
      expect(res.body.sessionToken).toBeDefined();
    });
  });

  // ─── Redis session storage ──────────────────────────────────────────────────

  describe('Redis session storage', () => {
    it('stores the session in Redis after login', async () => {
      const user = makeDiscordUser('d-005', 'eve', 'eve@example.com');
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(user);

      const state = await stateStore.generate();
      const res = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state}`)
        .expect(200);

      const { sessionToken, identity, profile } = res.body;

      const raw = await redisCache.get(`session:${sessionToken}`);
      expect(raw).not.toBeNull();

      const session = JSON.parse(raw!);
      expect(session.id).toBe(sessionToken);
      expect(session.identityId).toBe(identity.id);
      expect(session.profileId).toBe(profile.id);
      expect(session.provider).toBe('discord');
    });

    it('removes the session from Redis after logout', async () => {
      const user = makeDiscordUser('d-006', 'frank', 'frank@example.com');
      mockDiscord.exchangeCode.mockResolvedValue(makeTokens());
      mockDiscord.getUserInfo.mockResolvedValue(user);

      const state = await stateStore.generate();
      const login = await request(app.getHttpServer())
        .get(`/oauth/discord/callback?code=fake&state=${state}`)
        .expect(200);

      const { sessionToken } = login.body;

      await request(app.getHttpServer())
        .post('/oauth/logout')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      const raw = await redisCache.get(`session:${sessionToken}`);
      expect(raw).toBeNull();
    });
  });
});
