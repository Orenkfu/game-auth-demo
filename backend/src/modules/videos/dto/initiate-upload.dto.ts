import { IsString, IsNumber, IsPositive, IsOptional, Max, IsIn } from 'class-validator';

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];

export class InitiateUploadDto {
  @IsString()
  filename!: string;

  @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: string;

  @IsNumber()
  @IsPositive()
  @Max(10_000_000_000)
  fileSize!: number;

  @IsString()
  @IsOptional()
  title?: string;
}
