import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscordProvider } from './discord.provider';

describe('DiscordProvider', () => {
  let provider: DiscordProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'discord.clientId': 'test-client-id',
                'discord.clientSecret': 'test-secret',
                'discord.redirectUri': 'http://localhost:3001/callback',
              };
              return config[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'discord.clientId': 'test-client-id',
                'discord.clientSecret': 'test-secret',
                'discord.redirectUri': 'http://localhost:3001/callback',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<DiscordProvider>(DiscordProvider);
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state', () => {
      const url = provider.getAuthorizationUrl('test-state');

      expect(url).toContain('https://discord.com/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=identify+email');
    });

    it('should include redirect_uri', () => {
      const url = provider.getAuthorizationUrl('state');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('exchangeCode', () => {
    it('should throw on failed exchange', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('error'),
      });

      await expect(provider.exchangeCode('bad-code')).rejects.toThrow();
    });
  });

  describe('getUserInfo', () => {
    it('should throw on failed request', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('error'),
      });

      await expect(provider.getUserInfo('bad-token')).rejects.toThrow();
    });
  });
});