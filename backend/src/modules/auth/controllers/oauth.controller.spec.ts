import { UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OAuthController, OAuthCallbackQuery } from './oauth.controller';
import { OAuthService } from '../services/oauth.service';
import { SessionService } from '../services/session.service';
import type { Session } from '../services/session.service';
import {
  ERROR_MISSING_SESSION_TOKEN,
  ERROR_INVALID_SESSION,
  SUCCESS_LOGGED_OUT,
} from '../../../shared/constants';

const mockOAuthService = {
  getDiscordAuthUrl: jest.fn(),
  handleDiscordCallback: jest.fn(),
  getRiotAuthUrl: jest.fn(),
  handleRiotCallback: jest.fn(),
} as unknown as OAuthService;

const mockSessionService = {
  create: jest.fn(),
  validate: jest.fn(),
  revoke: jest.fn(),
} as unknown as SessionService;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-uuid',
    identityId: 'identity-uuid',
    profileId: 'profile-uuid',
    provider: 'discord',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

// ─── OAuthCallbackQuery validation ───────────────────────────────────────────

describe('OAuthCallbackQuery', () => {
  it('is valid when code and state are present', async () => {
    const query = plainToInstance(OAuthCallbackQuery, {
      code: 'abc123',
      state: 'xyz789',
    });
    const errors = await validate(query);
    expect(errors).toHaveLength(0);
  });

  it('fails validation when code is missing', async () => {
    const query = plainToInstance(OAuthCallbackQuery, { state: 'xyz789' });
    const errors = await validate(query);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('fails validation when state is missing', async () => {
    const query = plainToInstance(OAuthCallbackQuery, { code: 'abc123' });
    const errors = await validate(query);
    expect(errors.some((e) => e.property === 'state')).toBe(true);
  });

  it('fails validation when code is not a string', async () => {
    const query = plainToInstance(OAuthCallbackQuery, {
      code: 123,
      state: 'xyz',
    });
    const errors = await validate(query);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('allows optional error and error_description fields', async () => {
    const query = plainToInstance(OAuthCallbackQuery, {
      code: 'abc',
      state: 'xyz',
      error: 'access_denied',
      error_description: 'User denied access',
    });
    const errors = await validate(query);
    expect(errors).toHaveLength(0);
  });

  it('is valid without optional error fields', async () => {
    const query = plainToInstance(OAuthCallbackQuery, {
      code: 'abc',
      state: 'xyz',
    });
    const errors = await validate(query);
    expect(errors).toHaveLength(0);
  });
});

// ─── OAuthController ──────────────────────────────────────────────────────────

describe('OAuthController', () => {
  let controller: OAuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OAuthController(mockOAuthService, mockSessionService);
  });

  describe('validateSession', () => {
    it('throws when Authorization header is missing', async () => {
      await expect(
        controller.validateSession(undefined as unknown as string),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws with correct message when header is missing', async () => {
      await expect(
        controller.validateSession(undefined as unknown as string),
      ).rejects.toThrow(ERROR_MISSING_SESSION_TOKEN);
    });

    it('throws when scheme is not Bearer', async () => {
      await expect(
        controller.validateSession('Basic some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when session is not found', async () => {
      (mockSessionService.validate as jest.Mock).mockResolvedValue(null);
      await expect(
        controller.validateSession('Bearer unknown-token'),
      ).rejects.toThrow(ERROR_INVALID_SESSION);
    });

    it('returns valid:true and session when token is valid', async () => {
      const session = makeSession();
      (mockSessionService.validate as jest.Mock).mockResolvedValue(session);

      const result = await controller.validateSession('Bearer valid-token');

      expect(result).toEqual({ valid: true, session });
      expect(mockSessionService.validate).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('logout', () => {
    it('revokes the session token when present', async () => {
      (mockSessionService.revoke as jest.Mock).mockResolvedValue(undefined);

      await controller.logout('Bearer my-token');

      expect(mockSessionService.revoke).toHaveBeenCalledWith('my-token');
    });

    it('returns success message', async () => {
      (mockSessionService.revoke as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logout('Bearer my-token');

      expect(result).toEqual({ message: SUCCESS_LOGGED_OUT });
    });

    it('still returns success when no token is provided', async () => {
      const result = await controller.logout(undefined as unknown as string);

      expect(mockSessionService.revoke).not.toHaveBeenCalled();
      expect(result).toEqual({ message: SUCCESS_LOGGED_OUT });
    });
  });
});
