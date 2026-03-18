import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EMAIL_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_UPPERCASE_MESSAGE,
  PASSWORD_LOWERCASE_MESSAGE,
  PASSWORD_NUMBER_MESSAGE,
  PASSWORD_SPECIAL_CHAR_MESSAGE,
  USERNAME_VALIDATION_MESSAGE,
} from '../../../shared/constants';

export class CreateUserDto {
  @IsEmail({}, { message: EMAIL_VALIDATION_MESSAGE })
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_MIN_LENGTH_MESSAGE })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: PASSWORD_UPPERCASE_MESSAGE })
  @Matches(/[a-z]/, { message: PASSWORD_LOWERCASE_MESSAGE })
  @Matches(/[0-9]/, { message: PASSWORD_NUMBER_MESSAGE })
  @Matches(/[^A-Za-z0-9]/, {
    message: PASSWORD_SPECIAL_CHAR_MESSAGE,
  })
  password: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: USERNAME_VALIDATION_MESSAGE,
  })
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
