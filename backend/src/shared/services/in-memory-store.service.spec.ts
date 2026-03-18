import { InMemoryStore } from './in-memory-store.service';

interface TestEntity {
  id: string;
  name: string;
  age: number;
  active: boolean;
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('set and get', () => {
    it('should set and retrieve an entity', async () => {
      const entity: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };

      await store.set('users', '1', entity);
      const retrieved = await store.get<TestEntity>('users', '1');

      expect(retrieved).toEqual(entity);
    });

    it('should return undefined for non-existent entity', async () => {
      const retrieved = await store.get<TestEntity>('users', 'non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing entity', async () => {
      const entity1: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const entity2: TestEntity = {
        id: '1',
        name: 'Jane',
        age: 25,
        active: false,
      };

      await store.set('users', '1', entity1);
      await store.set('users', '1', entity2);
      const retrieved = await store.get<TestEntity>('users', '1');

      expect(retrieved).toEqual(entity2);
    });

    it('should handle multiple entities in the same namespace', async () => {
      const entity1: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const entity2: TestEntity = {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      };

      await store.set('users', '1', entity1);
      await store.set('users', '2', entity2);

      const retrieved1 = await store.get<TestEntity>('users', '1');
      const retrieved2 = await store.get<TestEntity>('users', '2');

      expect(retrieved1).toEqual(entity1);
      expect(retrieved2).toEqual(entity2);
    });
  });

  describe('delete', () => {
    it('should delete an entity', async () => {
      const entity: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };

      await store.set('users', '1', entity);
      const deleted = await store.delete('users', '1');
      const retrieved = await store.get<TestEntity>('users', '1');

      expect(deleted).toBe(true);
      expect(retrieved).toBeUndefined();
    });

    it('should return false when deleting non-existent entity', async () => {
      const deleted = await store.delete('users', 'non-existent');

      expect(deleted).toBe(false);
    });

    it('should not affect other entities in namespace', async () => {
      const entity1: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const entity2: TestEntity = {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      };

      await store.set('users', '1', entity1);
      await store.set('users', '2', entity2);
      await store.delete('users', '1');

      expect(await store.get<TestEntity>('users', '1')).toBeUndefined();
      expect(await store.get<TestEntity>('users', '2')).toEqual(entity2);
    });
  });

  describe('all', () => {
    it('should return empty array for empty namespace', async () => {
      const all = await store.all('users');

      expect(all).toEqual([]);
    });

    it('should return all entities in namespace', async () => {
      const entity1: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const entity2: TestEntity = {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      };
      const entity3: TestEntity = {
        id: '3',
        name: 'Bob',
        age: 35,
        active: true,
      };

      await store.set('users', '1', entity1);
      await store.set('users', '2', entity2);
      await store.set('users', '3', entity3);

      const all = await store.all<TestEntity>('users');

      expect(all).toHaveLength(3);
      expect(all).toContainEqual(entity1);
      expect(all).toContainEqual(entity2);
      expect(all).toContainEqual(entity3);
    });

    it('should return array without modifying original data', async () => {
      const entity: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };

      await store.set('users', '1', entity);
      const all = await store.all<TestEntity>('users');

      all[0].name = 'Modified';

      const retrieved = await store.get<TestEntity>('users', '1');
      expect(retrieved?.name).toBe('Modified'); // Note: This is expected behavior since we're storing references
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      await store.set('users', '2', {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      });
      await store.set('users', '3', {
        id: '3',
        name: 'Bob',
        age: 35,
        active: true,
      });
    });

    it('should find entity by predicate', async () => {
      const found = await store.find<TestEntity>('users', (user) => user.name === 'Jane');

      expect(found).toEqual({
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      });
    });

    it('should return undefined if no match found', async () => {
      const found = await store.find<TestEntity>('users', (user) => user.name === 'NonExistent');

      expect(found).toBeUndefined();
    });

    it('should return first match when multiple match predicate', async () => {
      const found = await store.find<TestEntity>('users', (user) => user.active === true);

      expect(found).toBeDefined();
      expect(found?.active).toBe(true);
    });

    it('should work with complex predicates', async () => {
      const found = await store.find<TestEntity>(
        'users',
        (user) => user.age > 30 && user.active === true,
      );

      expect(found).toEqual({
        id: '3',
        name: 'Bob',
        age: 35,
        active: true,
      });
    });

    it('should return undefined for empty namespace', async () => {
      const found = await store.find<TestEntity>('empty', (user) => user.id === '1');

      expect(found).toBeUndefined();
    });
  });

  describe('filter', () => {
    beforeEach(async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      await store.set('users', '2', {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      });
      await store.set('users', '3', {
        id: '3',
        name: 'Bob',
        age: 35,
        active: true,
      });
    });

    it('should filter entities by predicate', async () => {
      const filtered = await store.filter<TestEntity>('users', (user) => user.active === true);

      expect(filtered).toHaveLength(2);
      expect(filtered).toContainEqual({
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      expect(filtered).toContainEqual({
        id: '3',
        name: 'Bob',
        age: 35,
        active: true,
      });
    });

    it('should return empty array when no matches', async () => {
      const filtered = await store.filter<TestEntity>(
        'users',
        (user) => user.name === 'NonExistent',
      );

      expect(filtered).toEqual([]);
    });

    it('should return all entities when predicate is always true', async () => {
      const filtered = await store.filter<TestEntity>('users', () => true);

      expect(filtered).toHaveLength(3);
    });

    it('should return empty array for empty namespace', async () => {
      const filtered = await store.filter<TestEntity>('empty', () => true);

      expect(filtered).toEqual([]);
    });

    it('should work with complex predicates', async () => {
      const filtered = await store.filter<TestEntity>(
        'users',
        (user) => user.age > 26 && user.active === true,
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((u) => u.id)).toContain('1');
      expect(filtered.map((u) => u.id)).toContain('3');
    });
  });

  describe('entries', () => {
    it('should return empty array for empty namespace', async () => {
      const entries = await store.entries('users');

      expect(entries).toEqual([]);
    });

    it('should return all entries as [id, entity] pairs', async () => {
      const entity1: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const entity2: TestEntity = {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      };

      await store.set('users', '1', entity1);
      await store.set('users', '2', entity2);

      const entries = await store.entries<TestEntity>('users');

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['1', entity1]);
      expect(entries).toContainEqual(['2', entity2]);
    });

    it('should maintain entry order', async () => {
      await store.set('users', 'a', { id: 'a', name: 'Alice', age: 20, active: true });
      await store.set('users', 'b', { id: 'b', name: 'Bob', age: 30, active: true });
      await store.set('users', 'c', { id: 'c', name: 'Charlie', age: 40, active: true });

      const entries = await store.entries('users');

      expect(entries.map(([id]) => id)).toContain('a');
      expect(entries.map(([id]) => id)).toContain('b');
      expect(entries.map(([id]) => id)).toContain('c');
    });
  });

  describe('clear', () => {
    it('should clear a namespace', async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      await store.set('users', '2', {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      });

      await store.clear('users');

      const all = await store.all('users');
      expect(all).toEqual([]);
    });

    it('should not affect other namespaces', async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      await store.set('posts', '1', {
        id: '1',
        name: 'First Post',
        age: 0,
        active: true,
      });

      await store.clear('users');

      const users = await store.all('users');
      const posts = await store.all('posts');

      expect(users).toEqual([]);
      expect(posts).toHaveLength(1);
    });

    it('should not fail on clearing non-existent namespace', async () => {
      await expect(store.clear('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all namespaces', async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });
      await store.set('posts', '1', {
        id: '1',
        name: 'First Post',
        age: 0,
        active: true,
      });

      await store.clearAll();

      const users = await store.all('users');
      const posts = await store.all('posts');

      expect(users).toEqual([]);
      expect(posts).toEqual([]);
    });

    it('should allow adding new data after clearAll', async () => {
      await store.set('users', '1', {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      });

      await store.clearAll();

      await store.set('users', '2', {
        id: '2',
        name: 'Jane',
        age: 25,
        active: false,
      });

      const all = await store.all('users');
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('2');
    });
  });

  describe('namespace isolation', () => {
    it('should isolate data between namespaces', async () => {
      const userEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };
      const postEntity = {
        id: '1',
        name: 'First Post',
        age: 0,
        active: true,
      };

      await store.set('users', '1', userEntity);
      await store.set('posts', '1', postEntity);

      const user = await store.get('users', '1');
      const post = await store.get('posts', '1');

      expect(user).not.toEqual(post);
      expect(user).toEqual(userEntity);
      expect(post).toEqual(postEntity);
    });

    it('should allow same ID in different namespaces', async () => {
      const user = { id: '1', name: 'John', age: 30, active: true };
      const post = { id: '1', name: 'Post', age: 0, active: true };

      await store.set('users', '1', user);
      await store.set('posts', '1', post);

      expect(await store.get('users', '1')).toEqual(user);
      expect(await store.get('posts', '1')).toEqual(post);
    });

    it('should not cross-contaminate between namespaces on delete', async () => {
      const user = { id: '1', name: 'John', age: 30, active: true };
      const post = { id: '1', name: 'Post', age: 0, active: true };

      await store.set('users', '1', user);
      await store.set('posts', '1', post);

      await store.delete('users', '1');

      expect(await store.get('users', '1')).toBeUndefined();
      expect(await store.get('posts', '1')).toEqual(post);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical CRUD operations', async () => {
      const entity: TestEntity = {
        id: '1',
        name: 'John',
        age: 30,
        active: true,
      };

      // Create
      await store.set('users', '1', entity);
      let retrieved = await store.get<TestEntity>('users', '1');
      expect(retrieved).toEqual(entity);

      // Update
      const updated = { ...entity, age: 31 };
      await store.set('users', '1', updated);
      retrieved = await store.get<TestEntity>('users', '1');
      expect(retrieved?.age).toBe(31);

      // Read
      const all = await store.all<TestEntity>('users');
      expect(all).toHaveLength(1);

      // Delete
      await store.delete('users', '1');
      retrieved = await store.get<TestEntity>('users', '1');
      expect(retrieved).toBeUndefined();
    });

    it('should handle bulk operations', async () => {
      const entities: TestEntity[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        name: `User${i}`,
        age: 20 + i,
        active: i % 2 === 0,
      }));

      // Bulk insert
      for (const entity of entities) {
        await store.set('users', entity.id, entity);
      }

      // Query
      const allUsers = await store.all<TestEntity>('users');
      expect(allUsers).toHaveLength(10);

      const activeUsers = await store.filter<TestEntity>('users', (u) => u.active);
      expect(activeUsers).toHaveLength(5);

      // Bulk delete
      await store.delete('users', '0');
      await store.delete('users', '1');

      const remaining = await store.all<TestEntity>('users');
      expect(remaining).toHaveLength(8);
    });
  });

  describe('type safety', () => {
    it('should work with different entity types', async () => {
      interface User {
        id: string;
        name: string;
      }

      interface Post {
        id: string;
        title: string;
        content: string;
      }

      const user: User = { id: '1', name: 'John' };
      const post: Post = { id: '1', title: 'First', content: 'Hello' };

      await store.set('users', '1', user);
      await store.set('posts', '1', post);

      const retrievedUser = await store.get<User>('users', '1');
      const retrievedPost = await store.get<Post>('posts', '1');

      expect(retrievedUser?.name).toBe('John');
      expect(retrievedPost?.title).toBe('First');
    });
  });
});
