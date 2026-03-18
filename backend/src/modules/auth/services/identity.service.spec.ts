import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityRepository } from '../repositories/identity.repository';
import { IdentityStatus } from '../entities/identity.entity';
import { InMemoryStore } from '../../../shared/services/in-memory-store.service';

describe('IdentityService', () => {
  let service: IdentityService;
  let repository: IdentityRepository;

  beforeEach(async () => {
    const store = new InMemoryStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        IdentityRepository,
        {
          provide: InMemoryStore,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
    repository = module.get<IdentityRepository>(IdentityRepository);
  });

  describe('create', () => {
    it('should create identity with email', async () => {
      const identity = await service.create({
        email: 'test@example.com',
      });

      expect(identity.id).toBeDefined();
      expect(identity.email).toBe('test@example.com');
      expect(identity.emailVerified).toBe(false);
      expect(identity.status).toBe(IdentityStatus.ACTIVE);
    });

    it('should create identity with verified email', async () => {
      const identity = await service.create({
        email: 'test@example.com',
        emailVerified: true,
      });

      expect(identity.emailVerified).toBe(true);
    });

    it('should lowercase email', async () => {
      const identity = await service.create({ email: 'Test@Example.COM' });
      expect(identity.email).toBe('test@example.com');
    });
  });

  describe('findById', () => {
    it('should find identity by ID', async () => {
      const created = await service.create({ email: 'test@example.com' });
      const found = await service.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find identity by email', async () => {
      await service.create({ email: 'test@example.com' });
      const found = await service.findByEmail('test@example.com');

      expect(found).not.toBeNull();
      expect(found!.email).toBe('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      const found = await service.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt', async () => {
      const created = await service.create({ email: 'test@example.com' });
      expect(created.lastLoginAt).toBeNull();

      await service.updateLastLogin(created.id);

      const updated = await service.findById(created.id);
      expect(updated!.lastLoginAt).not.toBeNull();
    });

    it('should throw NotFoundException for non-existent identity', async () => {
      await expect(service.updateLastLogin('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});