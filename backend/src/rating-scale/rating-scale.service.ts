import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

export interface RatingScaleLabel {
  value: number;
  title: string;
  description: string;
}

export interface UpsertRatingScaleDto {
  maxRating: number;
  labels: RatingScaleLabel[];
}

const DEFAULT_LABELS: RatingScaleLabel[] = [
  { value: 1, title: 'Poor', description: 'Does not meet expectations' },
  { value: 2, title: 'Below Average', description: 'Partially meets expectations' },
  { value: 3, title: 'Average', description: 'Meets expectations' },
  { value: 4, title: 'Good', description: 'Exceeds expectations in most areas' },
  { value: 5, title: 'Excellent', description: 'Consistently exceeds all expectations' },
  { value: 6, title: 'Outstanding', description: 'Exceptional performance' },
  { value: 7, title: 'Exemplary', description: 'Role model for the team' },
  { value: 8, title: 'Distinguished', description: 'Significantly above exceptional' },
  { value: 9, title: 'Elite', description: 'Among the top performers' },
  { value: 10, title: 'World Class', description: 'Highest possible performance' },
];

@Injectable()
export class RatingScaleService {
  constructor(private prisma: PrismaService) {}

  async findByCompany(companyId: string): Promise<{ maxRating: number; labels: RatingScaleLabel[] }> {
    const scale = await this.prisma.ratingScale.findUnique({
      where: { companyId },
    });

    if (!scale) {
      return {
        maxRating: 5,
        labels: DEFAULT_LABELS.slice(0, 5),
      };
    }

    return {
      maxRating: scale.maxRating,
      labels: scale.labels as unknown as RatingScaleLabel[],
    };
  }

  async upsert(
    companyId: string,
    dto: UpsertRatingScaleDto,
  ): Promise<{ maxRating: number; labels: RatingScaleLabel[] }> {
    if (dto.maxRating < 1 || dto.maxRating > 10) {
      throw new BadRequestException('maxRating must be between 1 and 10');
    }

    // Build a complete labels array of exactly maxRating entries,
    // filling in defaults for any missing values
    const labelsMap = new Map(dto.labels.map((l) => [l.value, l]));
    const labels: RatingScaleLabel[] = Array.from({ length: dto.maxRating }, (_, i) => {
      const value = i + 1;
      return (
        labelsMap.get(value) ??
        DEFAULT_LABELS[i] ?? { value, title: `Level ${value}`, description: '' }
      );
    });

    const scale = await this.prisma.ratingScale.upsert({
      where: { companyId },
      create: { companyId, maxRating: dto.maxRating, labels: labels as any },
      update: { maxRating: dto.maxRating, labels: labels as any },
    });

    return {
      maxRating: scale.maxRating,
      labels: scale.labels as unknown as RatingScaleLabel[],
    };
  }
}
