import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

export class AddProfileSkillDto {
  @IsOptional()
  @IsString({ message: 'skillId must be a string' })
  skillId?: string;

  @IsOptional()
  @IsString({ message: 'skillName must be a string' })
  skillName?: string;

  @IsOptional()
  @IsNumber({}, { message: 'yearsOfExperience must be a number' })
  @Min(0, { message: 'yearsOfExperience cannot be negative' })
  yearsOfExperience?: number;

  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: 'proficiencyLevel must be BEGINNER, INTERMEDIATE, or ADVANCED',
  })
  proficiencyLevel?: ExperienceLevel;

  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: 'proficiency must be BEGINNER, INTERMEDIATE, or ADVANCED',
  })
  proficiency?: ExperienceLevel;
}
