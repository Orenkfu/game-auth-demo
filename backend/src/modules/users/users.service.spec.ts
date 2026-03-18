import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UserStatus } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const dto: CreateUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      };

      const user = await service.create(dto);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(dto.email);
      expect(user.username).toBe(dto.username);
      expect(user.emailVerified).toBe(false);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.passwordHash).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should set displayName when provided', async () => {
      const dto: CreateUserDto = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
        displayName: 'Test User',
      };

      const user = await service.create(dto);

      expect(user.displayName).toBe('Test User');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      const found = await service.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null when user not found', async () => {
      const found = await service.findById('non-existent-id');

      expect(found).toBeNull();
    });

    it('should return null for soft-deleted user', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });
      await service.softDelete(created.id);

      const found = await service.findById(created.id);

      expect(found).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return user when found', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      const found = await service.findByIdOrThrow(created.id);

      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      await expect(service.findByIdOrThrow('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email (case-insensitive)', async () => {
      await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      const found = await service.findByEmail('TEST@EXAMPLE.COM');

      expect(found).toBeDefined();
      expect(found?.email).toBe('test@example.com');
    });

    it('should return null when email not found', async () => {
      const found = await service.findByEmail('notfound@example.com');

      expect(found).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      const found = await service.findByUsername('testuser');

      expect(found).toBeDefined();
      expect(found?.username).toBe('testuser');
    });

    it('should return null when username not found', async () => {
      const found = await service.findByUsername('notfound');

      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      const updateDto: UpdateUserDto = {
        displayName: 'Updated Name',
        bio: 'My bio',
        gamerTag: 'ProGamer#123',
        preferredGames: ['Valorant', 'League of Legends'],
      };

      const updated = await service.update(created.id, updateDto);

      expect(updated.displayName).toBe('Updated Name');
      expect(updated.bio).toBe('My bio');
      expect(updated.gamerTag).toBe('ProGamer#123');
      expect(updated.preferredGames).toEqual(['Valorant', 'League of Legends']);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.createdAt.getTime(),
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      await expect(
        service.update('non-existent-id', { displayName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should mark user as deleted', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      await service.softDelete(created.id);

      // User should not be findable via normal methods
      const found = await service.findById(created.id);
      expect(found).toBeNull();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      await expect(service.softDelete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt timestamp', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      expect(created.lastLoginAt).toBeNull();

      await service.updateLastLogin(created.id);

      const updated = await service.findById(created.id);
      expect(updated?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('setPasswordHash', () => {
    it('should set password hash', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      expect(created.passwordHash).toBeNull();

      await service.setPasswordHash(created.id, 'hashed-password-value');

      const updated = await service.findById(created.id);
      expect(updated?.passwordHash).toBe('hashed-password-value');
    });
  });

  describe('setEmailVerified', () => {
    it('should set email as verified', async () => {
      const created = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
      });

      expect(created.emailVerified).toBe(false);

      await service.setEmailVerified(created.id, true);

      const updated = await service.findById(created.id);
      expect(updated?.emailVerified).toBe(true);
    });
  });
});
