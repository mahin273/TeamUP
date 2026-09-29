import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMeetingSlotDto {
  @IsNotEmpty({ message: 'Slot startTime is required' })
  @IsDateString(
    {},
    { message: 'Slot startTime must be a valid ISO 8601 date string' },
  )
  startTime: string;

  @IsNotEmpty({ message: 'Slot endTime is required' })
  @IsDateString(
    {},
    { message: 'Slot endTime must be a valid ISO 8601 date string' },
  )
  endTime: string;
}

export class CreateMeetingDto {
  @IsNotEmpty({ message: 'Meeting title is required' })
  @IsString({ message: 'Meeting title must be a string' })
  @MinLength(3, { message: 'Meeting title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Meeting title cannot exceed 100 characters' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Meeting description must be a string' })
  @MaxLength(1000, {
    message: 'Meeting description cannot exceed 1000 characters',
  })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Meeting slots must be an array' })
  @ArrayMinSize(1, { message: 'At least 1 candidate slot must be proposed' })
  @ArrayMaxSize(5, { message: 'Maximum 5 candidate slots can be proposed' })
  @ValidateNested({ each: true })
  @Type(() => CreateMeetingSlotDto)
  slots?: CreateMeetingSlotDto[];

  @IsOptional()
  @IsArray({ message: 'Meeting proposedSlots must be an array' })
  @ArrayMinSize(1, { message: 'At least 1 candidate slot must be proposed' })
  @ArrayMaxSize(5, { message: 'Maximum 5 candidate slots can be proposed' })
  @ValidateNested({ each: true })
  @Type(() => CreateMeetingSlotDto)
  proposedSlots?: CreateMeetingSlotDto[];
}
