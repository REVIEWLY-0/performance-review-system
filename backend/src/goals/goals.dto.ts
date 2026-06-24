import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  cycleId!: string;

  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class UpsertQuantScoreDto {
  @IsString()
  @IsNotEmpty()
  cycleId!: string;

  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
