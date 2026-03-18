import { InMemoryStore } from '../services/in-memory-store.service';

/**
 * Abstract base repository providing common CRUD operations.
 * Repositories handle storage concerns and provide a domain-specific interface.
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected abstract readonly namespace: string;

  constructor(protected readonly store: InMemoryStore) {}

  async create(entity: T): Promise<T> {
    await this.store.set(this.namespace, entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    const entity = await this.store.get<T>(this.namespace, id);
    return entity ?? null;
  }

  async findAll(): Promise<T[]> {
    return await this.store.all<T>(this.namespace);
  }

  async find(predicate: (item: T) => boolean): Promise<T | null> {
    const entity = await this.store.find<T>(this.namespace, predicate);
    return entity ?? null;
  }

  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    return await this.store.filter<T>(this.namespace, predicate);
  }

  async update(id: string, entity: T): Promise<T> {
    await this.store.set(this.namespace, id, entity);
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    return await this.store.delete(this.namespace, id);
  }

  async clear(): Promise<void> {
    await this.store.clear(this.namespace);
  }
}
