import { InMemoryCache } from './in-memory-cache.service';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new InMemoryCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should overwrite existing value', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      const result = await cache.get('key1');
      expect(result).toBe('value2');
    });
  });

  describe('TTL', () => {
    it('should expire value after TTL', async () => {
      await cache.set('key1', 'value1', 10); // 10 second TTL
      expect(await cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(11000);

      expect(await cache.get('key1')).toBeNull();
    });

    it('should not expire value without TTL', async () => {
      await cache.set('key1', 'value1');
      jest.advanceTimersByTime(100000);
      expect(await cache.get('key1')).toBe('value1');
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await cache.set('key1', 'value1');
      await cache.del('key1');
      expect(await cache.get('key1')).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(cache.del('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('expire', () => {
    it('should update TTL on existing key', async () => {
      await cache.set('key1', 'value1', 100);
      const result = await cache.expire('key1', 5);
      expect(result).toBe(true);

      jest.advanceTimersByTime(6000);
      expect(await cache.get('key1')).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const result = await cache.expire('nonexistent', 10);
      expect(result).toBe(false);
    });

    it('should return false for expired key', async () => {
      await cache.set('key1', 'value1', 5);
      jest.advanceTimersByTime(6000);
      const result = await cache.expire('key1', 10);
      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return remaining TTL', async () => {
      await cache.set('key1', 'value1', 10);
      const ttl = await cache.ttl('key1');
      expect(ttl).toBeGreaterThan(8);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it('should return -1 for key without expiry', async () => {
      await cache.set('key1', 'value1');
      const ttl = await cache.ttl('key1');
      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      const ttl = await cache.ttl('nonexistent');
      expect(ttl).toBe(-2);
    });

    it('should return -2 for expired key', async () => {
      await cache.set('key1', 'value1', 5);
      jest.advanceTimersByTime(6000);
      const ttl = await cache.ttl('key1');
      expect(ttl).toBe(-2);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.exists('key1')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await cache.exists('nonexistent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      await cache.set('key1', 'value1', 5);
      jest.advanceTimersByTime(6000);
      expect(await cache.exists('key1')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return keys matching pattern', async () => {
      await cache.set('user:1', 'a');
      await cache.set('user:2', 'b');
      await cache.set('session:1', 'c');

      const userKeys = await cache.keys('user:*');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
    });

    it('should not return expired keys', async () => {
      await cache.set('key1', 'value1', 5);
      await cache.set('key2', 'value2');

      jest.advanceTimersByTime(6000);

      const keys = await cache.keys('key*');
      expect(keys).toHaveLength(1);
      expect(keys).toContain('key2');
    });

    it('should handle ? wildcard', async () => {
      await cache.set('key1', 'a');
      await cache.set('key2', 'b');
      await cache.set('key10', 'c');

      const keys = await cache.keys('key?');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('delByPattern', () => {
    it('should delete keys matching pattern', async () => {
      await cache.set('session:1', 'a');
      await cache.set('session:2', 'b');
      await cache.set('user:1', 'c');

      const deleted = await cache.delByPattern('session:*');
      expect(deleted).toBe(2);

      expect(await cache.exists('session:1')).toBe(false);
      expect(await cache.exists('session:2')).toBe(false);
      expect(await cache.exists('user:1')).toBe(true);
    });

    it('should return 0 when no keys match', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delByPattern('nonexistent:*');
      expect(deleted).toBe(0);
    });
  });
});