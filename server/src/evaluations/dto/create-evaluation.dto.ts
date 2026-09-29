import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsInt,
  IsDefined,
} from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID(undefined, { message: 'evaluateeId must be a valid UUID' })
  @IsDefined({ message: 'evaluateeId is required' })
  evaluateeId: string;

  @IsOptional()
  @IsInt({ message: 'contributionScore must be an integer' })
  @Min(1, { message: 'contributionScore must be at least 1' })
  @Max(5, { message: 'contributionScore must be at most 5' })
  contributionScore?: number;

  @IsOptional()
  @IsInt({ message: 'communicationScore must be an integer' })
  @Min(1, { message: 'communicationScore must be at least 1' })
  @Max(5, { message: 'communicationScore must be at most 5' })
  communicationScore?: number;

  @IsOptional()
  @IsInt({ message: 'teamworkScore must be an integer' })
  @Min(1, { message: 'teamworkScore must be at least 1' })
  @Max(5, { message: 'teamworkScore must be at most 5' })
  teamworkScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
