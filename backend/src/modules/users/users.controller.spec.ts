import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserStatus } from './entities/user.entity';
import { UpdateUserDto } from './dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser: User = {
    id: 'test-uuid',
    email: 'test@example.com',
    emailVerified: true,
    passwordHash: 'hashed-password',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    bio: 'A test bio',
    gamerTag: 'Gamer#123',
    preferredGames: ['Valorant'],
    status: UserStatus.ACTIVE,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUsersService = {
    findByIdOrThrow: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('getPublicProfile', () => {
    it('should return public user profile', async () => {
      mockUsersService.findByIdOrThrow.mockResolvedValue(mockUser);

      const result = await controller.getPublicProfile('test-uuid');

      expect(service.findByIdOrThrow).toHaveBeenCalledWith('test-uuid');
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
      expect(result.displayName).toBe(mockUser.displayName);
      // Should not expose sensitive fields
      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).email).toBeUndefined();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findByIdOrThrow.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getPublicProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Note: getCurrentUser, updateCurrentUser, deleteCurrentUser tests
  // are placeholders until JWT auth is implemented
});
