import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CacheStore } from '../interfaces/cache-store.interface';

interface StoredValue {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class InMemoryCache implements CacheStore, OnModuleDestroy {
  private store = new Map<string, StoredValue>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref(); // Don't keep process alive for this
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, stored] of this.store.entries()) {
      if (stored.expiresAt && stored.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private isExpired(stored: StoredValue): boolean {
    return stored.expiresAt !== null && stored.expiresAt <= Date.now();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    const stored = this.store.get(key);
    if (!stored) return null;

    if (this.isExpired(stored)) {
      this.store.delete(key);
      return null;
    }

    return stored.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const stored = this.store.get(key);
    if (!stored || this.isExpired(stored)) return false;

    stored.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const stored = this.store.get(key);
    if (!stored) return -2;
    if (stored.expiresAt === null) return -1;

    const remaining = Math.ceil((stored.expiresAt - Date.now()) / 1000);
    if (remaining <= 0) {
      this.store.delete(key);
      return -2;
    }

    return remaining;
  }

  async keys(pattern: string): Promise<string[]> {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    const result: string[] = [];
    const now = Date.now();

    for (const [key, stored] of this.store.entries()) {
      if (stored.expiresAt && stored.expiresAt <= now) {
        this.store.delete(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }

    return result;
  }

  async exists(key: string): Promise<boolean> {
    const stored = this.store.get(key);
    if (!stored) return false;

    if (this.isExpired(stored)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    keys.forEach((key) => this.store.delete(key));
    return keys.length;
  }
}
