import { IsArray, IsOptional, IsNumber, IsString, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPartDto {
  @IsNumber()
  @IsPositive()
  partNumber!: number;

  @IsString()
  etag!: string;
}

export class CompleteUploadDto {
  // multipart only
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts?: UploadPartDto[];

  // metadata provided by client
  @IsNumber()
  @IsPositive()
  sizeBytes!: number;

  @IsNumber()
  @IsOptional()
  durationSecs?: number;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  height?: number;
}
