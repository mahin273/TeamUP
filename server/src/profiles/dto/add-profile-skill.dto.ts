import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

export class AddProfileSkillDto {
  @IsString({ message: 'skillId must be a string' })
  @IsNotEmpty({ message: 'skillId is required' })
  skillId: string;

  @IsOptional()
  @IsNumber({}, { message: 'yearsOfExperience must be a number' })
  @Min(0, { message: 'yearsOfExperience cannot be negative' })
  yearsOfExperience?: number;

  @IsOptional()
  @IsEnum(ExperienceLevel, { message: 'proficiencyLevel must be BEGINNER, INTERMEDIATE, or ADVANCED' })
  proficiencyLevel?: ExperienceLevel;
}
