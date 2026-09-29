import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class ProjectFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  tech?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'All' ? undefined : (value as ProjectStatus),
  )
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  skillId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;
}
