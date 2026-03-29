import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReviewType } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateReviewTypeConfigDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsEnum(ReviewType)
  baseType!: ReviewType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  key?: string; // Auto-generated from label if omitted
}

export class UpdateReviewTypeConfigDto {
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

@Injectable()
export class ReviewTypeConfigsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all active review type configs for a company (built-ins + custom)
   * CRITICAL: Always filter by companyId
   */
  async findAll(companyId: string) {
    return this.prisma.reviewTypeConfig.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Create a custom review type for a company
   */
  async create(companyId: string, dto: CreateReviewTypeConfigDto) {
    const key = dto.key
      ? dto.key.toUpperCase().replace(/\s+/g, '_')
      : dto.label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

    const existing = await this.prisma.reviewTypeConfig.findUnique({
      where: { companyId_key: { companyId, key } },
    });

    if (existing) {
      throw new BadRequestException(
        `A review type with key "${key}" already exists for this company.`,
      );
    }

    return this.prisma.reviewTypeConfig.create({
      data: {
        companyId,
        key,
        label: dto.label,
        baseType: dto.baseType,
        isBuiltIn: false,
        isActive: true,
      },
    });
  }

  /**
   * Update a review type config (label and/or isRequired)
   */
  async update(id: string, companyId: string, dto: UpdateReviewTypeConfigDto) {
    const config = await this.prisma.reviewTypeConfig.findFirst({
      where: { id, companyId },
    });

    if (!config) {
      throw new NotFoundException('Review type not found');
    }

    return this.prisma.reviewTypeConfig.update({
      where: { id },
      data: {
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.label !== undefined && !config.isBuiltIn && { label: dto.label }),
      },
    });
  }

  /**
   * Soft-delete a custom review type (built-ins cannot be deleted)
   */
  async delete(id: string, companyId: string) {
    const config = await this.prisma.reviewTypeConfig.findFirst({
      where: { id, companyId },
    });

    if (!config) {
      throw new NotFoundException('Review type not found');
    }

    if (config.isBuiltIn) {
      throw new BadRequestException('Built-in review types cannot be deleted.');
    }

    await this.prisma.reviewTypeConfig.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Review type deleted successfully' };
  }

  /**
   * Seed built-in review types for a newly created company.
   * Called from AuthService on signup.
   */
  async seedBuiltins(companyId: string) {
    await this.prisma.reviewTypeConfig.createMany({
      data: [
        {
          companyId,
          key: 'SELF',
          label: 'Self Review',
          baseType: ReviewType.SELF,
          isBuiltIn: true,
          sortOrder: 0,
        },
        {
          companyId,
          key: 'MANAGER',
          label: 'Manager Review',
          baseType: ReviewType.MANAGER,
          isBuiltIn: true,
          isRequired: true, // Manager review is required by default
          sortOrder: 1,
        },
        {
          companyId,
          key: 'PEER',
          label: 'Peer Review',
          baseType: ReviewType.PEER,
          isBuiltIn: true,
          sortOrder: 2,
        },
        {
          companyId,
          key: 'DOWNWARD',
          label: 'Team Evaluation',
          baseType: ReviewType.DOWNWARD,
          isBuiltIn: true,
          isRequired: false,
          isActive: true,
          sortOrder: 3,
        },
      ],
      skipDuplicates: true,
    });
  }
}
