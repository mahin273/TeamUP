import {
  IsString,
  IsNotEmpty,
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
import { ExperienceLevel } from '@prisma/client';

export class RequiredSkillItemDto {
  @IsOptional()
  @IsString({ message: 'skillId must be a string' })
  skillId?: string;

  @IsOptional()
  @IsString({ message: 'skillName must be a string' })
  skillName?: string;

  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: 'minimumExperience must be BEGINNER, INTERMEDIATE, or ADVANCED',
  })
  minimumExperience?: ExperienceLevel;
}

export class CreateProjectDto {
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @MinLength(3, { message: 'title must be at least 3 characters long' })
  title: string;

  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  @MinLength(10, { message: 'description must be at least 10 characters long' })
  description: string;

  @IsString({ message: 'domain must be a string' })
  @IsNotEmpty({ message: 'domain is required' })
  domain: string;

  @IsString({ message: 'semester must be a string' })
  @IsNotEmpty({ message: 'semester is required' })
  semester: string;

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
