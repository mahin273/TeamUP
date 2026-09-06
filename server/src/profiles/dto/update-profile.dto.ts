import { IsString, IsOptional, IsBoolean, IsEnum, MinLength } from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'fullName must be a string' })
  @MinLength(2, { message: 'fullName must be at least 2 characters long' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'bio must be a string' })
  bio?: string;

  @IsOptional()
  @IsString({ message: 'avatarUrl must be a string' })
  avatarUrl?: string;

  @IsOptional()
  @IsString({ message: 'department must be a string' })
  department?: string;

  @IsOptional()
  @IsString({ message: 'semester must be a string' })
  semester?: string;

  @IsOptional()
  @IsBoolean({ message: 'availability must be a boolean' })
  availability?: boolean;

  @IsOptional()
  @IsEnum(ExperienceLevel, { message: 'experienceLevel must be BEGINNER, INTERMEDIATE, or ADVANCED' })
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsString({ message: 'githubUsername must be a string' })
  githubUsername?: string;

  @IsOptional()
  @IsString({ message: 'portfolioUrl must be a string' })
  portfolioUrl?: string;
}
