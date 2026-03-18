import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CacheStore } from '../../../shared/interfaces/cache-store.interface';
import { SESSION_STORE } from '../../../shared/interfaces/cache-store.interface';
import {
  STATE_TTL_SECONDS,
  STATE_KEY_PREFIX,
  ERROR_INVALID_OAUTH_STATE,
} from '../../../shared/constants';

export interface OAuthStateData {
  redirectUrl?: string;
  linkToIdentityId?: string;
  codeVerifier?: string; // For PKCE (Riot)
}

@Injectable()
export class StateStoreService {
  constructor(@Inject(SESSION_STORE) private readonly cache: CacheStore) {}

  async generate(data: OAuthStateData = {}): Promise<string> {
    const state = crypto.randomUUID();

    await this.cache.set(
      STATE_KEY_PREFIX + state,
      JSON.stringify(data),
      STATE_TTL_SECONDS,
    );

    return state;
  }

  async validateAndConsume(state: string): Promise<OAuthStateData> {
    const key = STATE_KEY_PREFIX + state;
    const stored = await this.cache.get(key);

    if (!stored) {
      throw new UnauthorizedException(ERROR_INVALID_OAUTH_STATE);
    }

    // Delete immediately (consume)
    await this.cache.del(key);

    return JSON.parse(stored);
  }
}
