import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
  IsUrl,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

@ValidatorConstraint({ name: 'isValidSemester', async: false })
export class IsValidSemesterConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'number') {
      return Number.isInteger(value) && value >= 1 && value <= 8;
    }
    if (typeof value === 'string') {
      const num = Number(value.trim());
      if (!isNaN(num) && Number.isInteger(num)) {
        return num >= 1 && num <= 8;
      }
      return false;
    }
    return false;
  }
  defaultMessage() {
    return 'Semester must be an integer between 1 and 8';
  }
}

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
  @Validate(IsValidSemesterConstraint)
  semester?: any;

  @IsOptional()
  @IsBoolean({ message: 'availability must be a boolean' })
  availability?: boolean;

  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: 'experienceLevel must be BEGINNER, INTERMEDIATE, or ADVANCED',
  })
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsString({ message: 'githubUsername must be a string' })
  githubUsername?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'portfolioUrl must be a valid HTTP or HTTPS URL' },
  )
  portfolioUrl?: string;
}
