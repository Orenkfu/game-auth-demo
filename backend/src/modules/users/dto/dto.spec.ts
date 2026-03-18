import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

describe('CreateUserDto', () => {
  const validDto = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    username: 'validuser',
  };

  it('should pass validation with valid data', async () => {
    const dto = plainToInstance(CreateUserDto, validDto);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('email validation', () => {
    it('should fail with invalid email', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        email: 'not-an-email',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should transform email to lowercase', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        email: 'TEST@EXAMPLE.COM',
      });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim whitespace from email', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        email: '  test@example.com  ',
      });
      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('password validation', () => {
    it('should fail when password is too short', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        password: 'Short1!',
      });
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when password has no uppercase', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        password: 'nouppercase123!',
      });
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when password has no lowercase', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        password: 'NOLOWERCASE123!',
      });
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when password has no number', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        password: 'NoNumberHere!!',
      });
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when password has no special character', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        password: 'NoSpecialChar123',
      });
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });
  });

  describe('username validation', () => {
    it('should fail when username is too short', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        username: 'ab',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('should fail when username has invalid characters', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        username: 'invalid@user',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('should allow underscores and hyphens', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        username: 'valid_user-name',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('displayName validation', () => {
    it('should allow optional displayName', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        displayName: 'My Display Name',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when displayName is too long', async () => {
      const dto = plainToInstance(CreateUserDto, {
        ...validDto,
        displayName: 'a'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'displayName')).toBe(true);
    });
  });
});

describe('UpdateUserDto', () => {
  it('should pass validation with empty object', async () => {
    const dto = plainToInstance(UpdateUserDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation with all valid fields', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      displayName: 'New Name',
      bio: 'My bio',
      avatarUrl: 'https://example.com/avatar.png',
      gamerTag: 'Gamer#123',
      preferredGames: ['Valorant', 'LoL'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail with invalid avatar URL', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      avatarUrl: 'not-a-url',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
  });

  it('should fail when bio is too long', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      bio: 'a'.repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bio')).toBe(true);
  });

  it('should fail when preferredGames has too many items', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      preferredGames: Array(11).fill('Game'),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'preferredGames')).toBe(true);
  });
});
