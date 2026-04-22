import { IsString, IsOptional, IsEnum } from 'class-validator';
import { VideoVisibility } from '../types';

export class UpdateVideoDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(VideoVisibility)
  @IsOptional()
  visibility?: VideoVisibility;
}
