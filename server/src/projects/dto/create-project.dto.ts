import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceLevel } from '@prisma/client';

export function IsValidSkillsArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidSkillsArray',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!Array.isArray(value)) return false;
          for (const item of value) {
            if (typeof item === 'string') {
              if (!item.trim()) return false;
            } else if (item && typeof item === 'object') {
              if (item.skillId && typeof item.skillId !== 'string')
                return false;
              if (item.skillName && typeof item.skillName !== 'string')
                return false;
              if (!item.skillId && !item.skillName) return false;
            } else {
              return false;
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an array of strings or skill objects`;
        },
      },
    });
  };
}

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
  title: string;

  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  description: string;

  @IsString({ message: 'domain must be a string' })
  @IsNotEmpty({ message: 'domain is required' })
  domain: string;

  @IsOptional()
  @IsString({ message: 'semester must be a string' })
  semester?: string;

  @IsOptional()
  @IsInt({ message: 'maxMembers must be an integer' })
  @Min(1, { message: 'maxMembers must be at least 1' })
  @Max(20, { message: 'maxMembers cannot exceed 20' })
  @Type(() => Number)
  maxMembers?: number;

  @IsOptional()
  @IsInt({ message: 'teamSizeNeeded must be an integer' })
  @Min(1, { message: 'teamSizeNeeded must be at least 1' })
  @Max(20, { message: 'teamSizeNeeded cannot exceed 20' })
  @Type(() => Number)
  teamSizeNeeded?: number;

  @IsOptional()
  @IsValidSkillsArray({
    message:
      'requiredSkills must be an array of strings or valid skill objects',
  })
  requiredSkills?: any[];
}
