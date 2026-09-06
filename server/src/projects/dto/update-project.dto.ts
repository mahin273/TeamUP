import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';
import { RequiredSkillItemDto } from './create-project.dto';

export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 characters long' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MinLength(10, { message: 'description must be at least 10 characters long' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'domain must be a string' })
  domain?: string;

  @IsOptional()
  @IsString({ message: 'semester must be a string' })
  semester?: string;

  @IsOptional()
  @IsEnum(ProjectStatus, {
    message: 'status must be OPEN, IN_PROGRESS, COMPLETED, or ARCHIVED',
  })
  status?: ProjectStatus;

  @IsOptional()
  @IsInt({ message: 'maxMembers must be an integer' })
  @Min(2, { message: 'maxMembers must be at least 2' })
  @Max(20, { message: 'maxMembers cannot exceed 20' })
  @Type(() => Number)
  maxMembers?: number;

  @IsOptional()
  @IsArray({ message: 'requiredSkills must be an array' })
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillItemDto)
  requiredSkills?: RequiredSkillItemDto[];
}
