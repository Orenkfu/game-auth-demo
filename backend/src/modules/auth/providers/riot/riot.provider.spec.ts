import { ConfigService } from '@nestjs/config';
import { RiotProvider } from './riot.provider';

const mockConfig = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'riot.clientId': 'test-riot-client-id',
      'riot.clientSecret': 'test-riot-secret',
      'riot.redirectUri': 'http://localhost:3001/oauth/riot/callback',
    };
    return config[key];
  }),
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'riot.clientId': 'test-riot-client-id',
      'riot.clientSecret': 'test-riot-secret',
      'riot.redirectUri': 'http://localhost:3001/oauth/riot/callback',
    };
    if (!config[key]) throw new Error(`Config key not found: ${key}`);
    return config[key];
  }),
} as unknown as ConfigService;

describe('RiotProvider', () => {
  let provider: RiotProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new RiotProvider(mockConfig);
  });

  describe('generatePKCE', () => {
    it('returns a codeVerifier and codeChallenge', () => {
      const { codeVerifier, codeChallenge } = provider.generatePKCE();

      expect(typeof codeVerifier).toBe('string');
      expect(typeof codeChallenge).toBe('string');
      expect(codeVerifier.length).toBeGreaterThan(0);
      expect(codeChallenge.length).toBeGreaterThan(0);
    });

    it('returns different values on each call', () => {
      const first = provider.generatePKCE();
      const second = provider.generatePKCE();

      expect(first.codeVerifier).not.toBe(second.codeVerifier);
      expect(first.codeChallenge).not.toBe(second.codeChallenge);
    });

    it('codeChallenge is the SHA-256 base64url hash of codeVerifier', () => {
      const crypto = require('crypto');
      const { codeVerifier, codeChallenge } = provider.generatePKCE();
      const expected = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      expect(codeChallenge).toBe(expected);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns a URL containing the Riot OAuth authorize endpoint', () => {
      const url = provider.getAuthorizationUrl('test-state', 'test-challenge');

      expect(url).toContain('https://auth.riotgames.com/authorize');
    });

    it('includes required OAuth parameters', () => {
      const url = provider.getAuthorizationUrl('my-state', 'my-challenge');

      expect(url).toContain('client_id=test-riot-client-id');
      expect(url).toContain('state=my-state');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge=my-challenge');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('includes the redirect_uri', () => {
      const url = provider.getAuthorizationUrl('s', 'c');

      expect(url).toContain('redirect_uri=');
    });

    it('includes the configured scopes', () => {
      const url = provider.getAuthorizationUrl('s', 'c');

      expect(url).toContain('scope=');
    });
  });

  describe('exchangeCode', () => {
    it('throws UnauthorizedException on failed exchange', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      });

      await expect(
        provider.exchangeCode('bad-code', 'verifier'),
      ).rejects.toThrow();
    });

    it('returns token response on success', async () => {
      const mockTokens = {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      });

      const result = await provider.exchangeCode('code', 'verifier');

      expect(result).toEqual(mockTokens);
    });

    it('sends Basic auth header with client credentials', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
      });

      await provider.exchangeCode('code', 'verifier');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const authHeader = (init.headers as Record<string, string>)['Authorization'];
      expect(authHeader).toMatch(/^Basic /);
    });
  });

  describe('refreshTokens', () => {
    it('throws on failed refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_token'),
      });

      await expect(provider.refreshTokens('bad-refresh')).rejects.toThrow();
    });

    it('returns new tokens on success', async () => {
      const mockTokens = { access_token: 'new-at', expires_in: 3600 };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      });

      const result = await provider.refreshTokens('rt');

      expect(result).toEqual(mockTokens);
    });
  });

  describe('getAccountInfo', () => {
    it('throws on failed request', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('unauthorized'),
      });

      await expect(provider.getAccountInfo('bad-token')).rejects.toThrow();
    });

    it('returns account info on success', async () => {
      const mockAccount = {
        puuid: 'puuid-123',
        gameName: 'Player',
        tagLine: 'EUW',
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAccount),
      });

      const result = await provider.getAccountInfo('valid-token');

      expect(result).toEqual(mockAccount);
    });

    it('sends Bearer token in Authorization header', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ puuid: 'p', gameName: 'g', tagLine: 't' }),
      });

      await provider.getAccountInfo('my-access-token');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const authHeader = (init.headers as Record<string, string>)['Authorization'];
      expect(authHeader).toBe('Bearer my-access-token');
    });
  });
});
