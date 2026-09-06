import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSkillDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsOptional()
  @IsString({ message: 'category must be a string' })
  category?: string;
}
