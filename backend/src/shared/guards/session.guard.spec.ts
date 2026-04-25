import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from './session.guard';
import type { CacheStore } from '../interfaces/cache-store.interface';
import type { Session } from '../../modules/auth/services/session.service';
import { SESSION_TTL_DEFAULT } from '../constants/storage.constants';

const mockStore: jest.Mocked<CacheStore> = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  delByPattern: jest.fn(),
};

function makeConfig(ttlSeconds?: number): ConfigService {
  return {
    get: jest.fn((_key: string, defaultValue?: unknown) =>
      ttlSeconds ?? defaultValue,
    ),
  } as unknown as ConfigService;
}

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

function makeContext(authHeader?: string): ExecutionContext {
  const req = { headers: { authorization: authHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  let guard: SessionGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new SessionGuard(mockStore, makeConfig());
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when scheme is not Bearer', async () => {
    const ctx = makeContext('Basic some-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when session is not found in store', async () => {
    mockStore.get.mockResolvedValue(null);
    const ctx = makeContext('Bearer unknown-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('returns true and attaches session to request for a valid token', async () => {
    const session = makeSession();
    mockStore.get.mockResolvedValue(JSON.stringify(session));
    mockStore.set.mockResolvedValue(undefined);

    const req = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((req as any).session.id).toBe(session.id);
    expect((req as any).session.identityId).toBe(session.identityId);
  });

  it('refreshes the sliding window TTL on a valid request', async () => {
    const session = makeSession();
    mockStore.get.mockResolvedValue(JSON.stringify(session));
    mockStore.set.mockResolvedValue(undefined);

    const ctx = makeContext('Bearer valid-token');
    await guard.canActivate(ctx);

    expect(mockStore.set).toHaveBeenCalledWith(
      'session:valid-token',
      expect.any(String),
      expect.any(Number),
    );
  });

  it('updates lastActivityAt when refreshing the session', async () => {
    const session = makeSession({ lastActivityAt: 1000 });
    mockStore.get.mockResolvedValue(JSON.stringify(session));
    mockStore.set.mockResolvedValue(undefined);

    const ctx = makeContext('Bearer valid-token');
    await guard.canActivate(ctx);

    const stored = JSON.parse(mockStore.set.mock.calls[0][1] as string);
    expect(stored.lastActivityAt).toBeGreaterThan(1000);
  });

  it('uses the configured SESSION_TTL_SECONDS when refreshing, not the default', async () => {
    const customTtl = 3600;
    const customGuard = new SessionGuard(mockStore, makeConfig(customTtl));
    mockStore.get.mockResolvedValue(JSON.stringify(makeSession()));
    mockStore.set.mockResolvedValue(undefined);

    await customGuard.canActivate(makeContext('Bearer valid-token'));

    expect(mockStore.set).toHaveBeenCalledWith(
      'session:valid-token',
      expect.any(String),
      customTtl,
    );
    expect(mockStore.set.mock.calls[0][2]).not.toBe(SESSION_TTL_DEFAULT);
  });

  it('falls back to SESSION_TTL_DEFAULT when SESSION_TTL_SECONDS is unset', async () => {
    mockStore.get.mockResolvedValue(JSON.stringify(makeSession()));
    mockStore.set.mockResolvedValue(undefined);

    await guard.canActivate(makeContext('Bearer valid-token'));

    expect(mockStore.set).toHaveBeenCalledWith(
      'session:valid-token',
      expect.any(String),
      SESSION_TTL_DEFAULT,
    );
  });
});
