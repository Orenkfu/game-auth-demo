import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CacheStore } from '../interfaces/cache-store.interface';
import { SESSION_STORE } from '../interfaces/cache-store.interface';
import type { Session } from '../../modules/auth/services/session.service';
import {
  SESSION_KEY_PREFIX,
  SESSION_TTL_DEFAULT,
} from '../constants/storage.constants';
import {
  ERROR_MISSING_SESSION_TOKEN,
  ERROR_INVALID_SESSION,
} from '../constants/messages.constants';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SESSION_STORE) private readonly store: CacheStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req.headers['authorization']);

    if (!token) {
      throw new UnauthorizedException(ERROR_MISSING_SESSION_TOKEN);
    }

    const raw = await this.store.get(SESSION_KEY_PREFIX + token);
    if (!raw) {
      throw new UnauthorizedException(ERROR_INVALID_SESSION);
    }

    const session: Session = JSON.parse(raw);

    // Refresh sliding window TTL
    session.lastActivityAt = Date.now();
    await this.store.set(
      SESSION_KEY_PREFIX + token,
      JSON.stringify(session),
      SESSION_TTL_DEFAULT,
    );

    (req as Request & { session: Session }).session = session;
    return true;
  }

  private extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? (token ?? null) : null;
  }
}
