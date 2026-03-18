/**
 * Generic cache interface with TTL support.
 * Can be backed by Redis, in-memory, or any other cache.
 */
export interface CacheStore {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
  delByPattern(pattern: string): Promise<number>;
}

// DI tokens for different cache usages
export const SESSION_STORE = Symbol('SESSION_STORE');
export const STATE_STORE = Symbol('STATE_STORE');
