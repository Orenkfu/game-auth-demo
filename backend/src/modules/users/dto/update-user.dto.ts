import {
  IsString,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { AVATAR_URL_VALIDATION_MESSAGE } from '../../../shared/constants';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: AVATAR_URL_VALIDATION_MESSAGE })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gamerTag?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  preferredGames?: string[];
}
