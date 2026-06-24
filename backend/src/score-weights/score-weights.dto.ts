import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateScoreWeightsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  quantWeight!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  managerWeight!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  peerWeight!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  selfWeight!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  minPeerThreshold?: number;
}
