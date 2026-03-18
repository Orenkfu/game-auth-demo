import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
import { ERROR_USER_NOT_FOUND } from '../../shared/constants';

@Injectable()
export class UsersService {
  // TODO: Replace with actual database repository
  private users: Map<string, User> = new Map();

  async create(createUserDto: CreateUserDto): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();

    const user: User = {
      id,
      email: createUserDto.email,
      emailVerified: false,
      passwordHash: null, // Will be set by auth service
      username: createUserDto.username,
      displayName: createUserDto.displayName ?? null,
      avatarUrl: null,
      bio: null,
      gamerTag: null,
      preferredGames: [],
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.users.set(id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (!user || user.deletedAt) return null;
    return user;
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(ERROR_USER_NOT_FOUND);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email.toLowerCase() && !user.deletedAt) {
        return user;
      }
    }
    return null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username && !user.deletedAt) {
        return user;
      }
    }
    return null;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrThrow(id);

    const updatedUser: User = {
      ...user,
      ...updateUserDto,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.findByIdOrThrow(id);

    const deletedUser: User = {
      ...user,
      status: UserStatus.DELETED,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(id, deletedUser);
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = await this.findByIdOrThrow(id);

    const updatedUser: User = {
      ...user,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    const user = await this.findByIdOrThrow(id);

    const updatedUser: User = {
      ...user,
      passwordHash,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
  }

  async setEmailVerified(id: string, verified: boolean): Promise<void> {
    const user = await this.findByIdOrThrow(id);

    const updatedUser: User = {
      ...user,
      emailVerified: verified,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
  }
}
