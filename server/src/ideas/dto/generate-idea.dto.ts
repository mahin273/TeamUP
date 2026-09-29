import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

export class GenerateIdeaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  domain: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tech?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsString()
  techInterest?: string;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  difficulty?: ExperienceLevel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
