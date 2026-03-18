import { Injectable } from '@nestjs/common';

/**
 * Generic in-memory entity store for development/testing.
 * Replace with database repositories in production.
 *
 * Namespaced by entity type to avoid collisions.
 */
@Injectable()
export class InMemoryStore {
  private stores: Map<string, Map<string, unknown>> = new Map();

  private getNamespace<T>(namespace: string): Map<string, T> {
    if (!this.stores.has(namespace)) {
      this.stores.set(namespace, new Map());
    }
    return this.stores.get(namespace) as Map<string, T>;
  }

  async set<T>(namespace: string, id: string, entity: T): Promise<void> {
    this.getNamespace<T>(namespace).set(id, entity);
  }

  async get<T>(namespace: string, id: string): Promise<T | undefined> {
    return this.getNamespace<T>(namespace).get(id);
  }

  async delete(namespace: string, id: string): Promise<boolean> {
    return this.getNamespace(namespace).delete(id);
  }

  async all<T>(namespace: string): Promise<T[]> {
    return Array.from(this.getNamespace<T>(namespace).values());
  }

  async find<T>(
    namespace: string,
    predicate: (item: T) => boolean,
  ): Promise<T | undefined> {
    for (const item of this.getNamespace<T>(namespace).values()) {
      if (predicate(item)) {
        return item;
      }
    }
    return undefined;
  }

  async filter<T>(
    namespace: string,
    predicate: (item: T) => boolean,
  ): Promise<T[]> {
    const results: T[] = [];
    for (const item of this.getNamespace<T>(namespace).values()) {
      if (predicate(item)) {
        results.push(item);
      }
    }
    return results;
  }

  async entries<T>(namespace: string): Promise<[string, T][]> {
    return Array.from(this.getNamespace<T>(namespace).entries());
  }

  async clear(namespace: string): Promise<void> {
    this.stores.delete(namespace);
  }

  async clearAll(): Promise<void> {
    this.stores.clear();
  }
}
