import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { CurrentSession } from './current-session.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { Session } from '../../modules/auth/services/session.service';

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

function makeContext(session?: Session): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (session !== undefined) req.session = session;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

// Apply the decorator to a dummy class to extract its factory from metadata
function getDecoratorFactory() {
  class DummyController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentSession() _session: Session) {}
  }
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, DummyController, 'handler') as
    | Record<string, { factory: (data: unknown, ctx: ExecutionContext) => Session }>
    | undefined;
  if (!metadata) throw new Error('No route args metadata found');
  const key = Object.keys(metadata)[0];
  return metadata[key].factory;
}

describe('CurrentSession decorator', () => {
  let factory: (data: unknown, ctx: ExecutionContext) => Session;

  beforeAll(() => {
    factory = getDecoratorFactory();
  });

  it('returns the session attached to the request', () => {
    const session = makeSession();
    const result = factory(undefined, makeContext(session));
    expect(result).toEqual(session);
  });

  it('returns undefined when no session is on the request', () => {
    const result = factory(undefined, makeContext(undefined));
    expect(result).toBeUndefined();
  });

  it('returns session with correct fields', () => {
    const session = makeSession({ identityId: 'custom-id', provider: 'riot' });
    const result = factory(undefined, makeContext(session));
    expect(result.identityId).toBe('custom-id');
    expect(result.provider).toBe('riot');
  });
});
