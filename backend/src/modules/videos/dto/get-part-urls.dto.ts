import { IsArray, IsNumber, ArrayNotEmpty, ArrayMaxSize, IsPositive } from 'class-validator';

export class GetPartUrlsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10000)
  @IsNumber({}, { each: true })
  @IsPositive({ each: true })
  partNumbers!: number[];
}
