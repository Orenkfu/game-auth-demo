import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { CacheStore } from '../../../shared/interfaces/cache-store.interface';
import { SESSION_STORE } from '../../../shared/interfaces/cache-store.interface';

export interface Session {
  id: string;
  identityId: string;
  profileId: string;
  provider: string;
  createdAt: number;
  lastActivityAt: number;
}

export interface CreateSessionDto {
  identityId: string;
  profileId: string;
  provider: string;
}

@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;
  private readonly keyPrefix = 'session:';

  constructor(
    @Inject(SESSION_STORE) private readonly store: CacheStore,
    private readonly config: ConfigService,
  ) {
    this.ttlSeconds = this.config.get<number>('SESSION_TTL_SECONDS', 86400); // 24h default
  }

  async create(dto: CreateSessionDto): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      identityId: dto.identityId,
      profileId: dto.profileId,
      provider: dto.provider,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.store.set(
      this.keyPrefix + session.id,
      JSON.stringify(session),
      this.ttlSeconds,
    );

    return session;
  }

  async get(sessionId: string): Promise<Session | null> {
    const data = await this.store.get(this.keyPrefix + sessionId);
    if (!data) return null;

    return JSON.parse(data);
  }

  async validate(sessionId: string): Promise<Session | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    // Refresh sliding window
    await this.touch(sessionId);

    return session;
  }

  async touch(sessionId: string): Promise<boolean> {
    const key = this.keyPrefix + sessionId;
    const data = await this.store.get(key);
    if (!data) return false;

    const session: Session = JSON.parse(data);
    session.lastActivityAt = Date.now();

    await this.store.set(key, JSON.stringify(session), this.ttlSeconds);
    return true;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.store.del(this.keyPrefix + sessionId);
  }

  async revokeAllForIdentity(identityId: string): Promise<number> {
    const keys = await this.store.keys(`${this.keyPrefix}*`);
    let count = 0;

    for (const key of keys) {
      const data = await this.store.get(key);
      if (data) {
        const session: Session = JSON.parse(data);
        if (session.identityId === identityId) {
          await this.store.del(key);
          count++;
        }
      }
    }

    return count;
  }
}
