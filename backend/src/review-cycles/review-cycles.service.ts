import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReviewCycleStatus, ReviewType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import {
  IsString, IsEnum, IsOptional, IsNumber, IsArray, IsDateString,
  ValidateNested, MinLength, MaxLength, Min, Max, ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// Defined before CreateReviewCycleDto so @Type(() => ReviewConfigDto) resolves correctly
export class ReviewConfigDto {
  @IsNumber()
  @Min(1)
  @Max(3)
  stepNumber!: number;

  @IsEnum(ReviewType)
  reviewType!: ReviewType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class CreateReviewCycleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewConfigDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  reviewConfigs!: ReviewConfigDto[];
}

export class UpdateReviewCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Wrapper for PUT /review-cycles/:id/configs body
export class UpdateConfigsBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewConfigDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  configs!: ReviewConfigDto[];
}

@Injectable()
export class ReviewCyclesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Get all review cycles for a company, optionally filtered by status
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async findAll(companyId: string, status?: ReviewCycleStatus) {
    console.log(
      `📋 Fetching review cycles for company: ${companyId}, status: ${status || 'all'}`,
    );

    return this.prisma.reviewCycle.findMany({
      where: {
        companyId,
        ...(status && { status }),
      },
      include: {
        reviewConfigs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Get a single review cycle by ID
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async findOne(id: string, companyId: string) {
    console.log(`🔍 Fetching review cycle ${id} for company ${companyId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        reviewConfigs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Review cycle with ID ${id} not found`);
    }

    return cycle;
  }

  /**
   * Create a new review cycle with workflow configs
   * CRITICAL: Always set companyId for multi-tenancy
   */
  async create(companyId: string, dto: CreateReviewCycleDto) {
    console.log(
      `➕ Creating review cycle for company ${companyId}:`,
      dto.name,
    );

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate cycle dates
    this.validateDates(startDate, endDate);

    // Validate configs
    if (!dto.reviewConfigs || dto.reviewConfigs.length === 0) {
      throw new BadRequestException(
        'At least one workflow step is required',
      );
    }

    this.validateConfigDates(startDate, endDate, dto.reviewConfigs);

    // Create cycle with configs in transaction
    return this.prisma.$transaction(async (prisma) => {
      const cycle = await prisma.reviewCycle.create({
        data: {
          companyId,
          name: dto.name,
          startDate,
          endDate,
          status: 'DRAFT',
        },
      });

      // Create configs
      await prisma.reviewConfig.createMany({
        data: dto.reviewConfigs.map((config) => ({
          reviewCycleId: cycle.id,
          stepNumber: config.stepNumber,
          reviewType: config.reviewType,
          startDate: new Date(config.startDate),
          endDate: new Date(config.endDate),
        })),
      });

      // Return cycle with configs
      return prisma.reviewCycle.findUnique({
        where: { id: cycle.id },
        include: {
          reviewConfigs: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      });
    });
  }

  /**
   * Update review cycle basic info (name, dates)
   * Can only update DRAFT cycles
   */
  async update(id: string, companyId: string, dto: UpdateReviewCycleDto) {
    console.log(`✏️ Updating review cycle ${id} for company ${companyId}`);

    // Verify cycle exists and belongs to company
    const cycle = await this.findOne(id, companyId);

    // Can only update DRAFT cycles
    if (cycle.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot update ${cycle.status} cycle. Only DRAFT cycles can be edited.`,
      );
    }

    // Validate date changes if provided
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate
        ? new Date(dto.startDate)
        : cycle.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
      this.validateDates(startDate, endDate);

      // Validate that existing configs still fall within new dates
      if (cycle.reviewConfigs.length > 0) {
        this.validateConfigDates(
          startDate,
          endDate,
          cycle.reviewConfigs.map((config) => ({
            stepNumber: config.stepNumber,
            reviewType: config.reviewType,
            startDate: config.startDate.toISOString(),
            endDate: config.endDate.toISOString(),
          })),
        );
      }
    }

    return this.prisma.reviewCycle.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      },
      include: {
        reviewConfigs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Update workflow configs for a review cycle
   * Can only update DRAFT cycles
   */
  async updateConfigs(
    id: string,
    companyId: string,
    configs: ReviewConfigDto[],
  ) {
    console.log(
      `🔄 Updating workflow configs for cycle ${id}, company ${companyId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.findOne(id, companyId);

    // Can only update DRAFT cycles
    if (cycle.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot update configs for ${cycle.status} cycle. Only DRAFT cycles can be edited.`,
      );
    }

    // Validate configs
    if (!configs || configs.length === 0) {
      throw new BadRequestException(
        'At least one workflow step is required',
      );
    }

    this.validateConfigDates(cycle.startDate, cycle.endDate, configs);

    // Replace configs in transaction
    return this.prisma.$transaction(async (prisma) => {
      // Delete old configs
      await prisma.reviewConfig.deleteMany({
        where: { reviewCycleId: id },
      });

      // Create new configs
      await prisma.reviewConfig.createMany({
        data: configs.map((config) => ({
          reviewCycleId: id,
          stepNumber: config.stepNumber,
          reviewType: config.reviewType,
          startDate: new Date(config.startDate),
          endDate: new Date(config.endDate),
        })),
      });

      // Return updated cycle
      return prisma.reviewCycle.findUnique({
        where: { id },
        include: {
          reviewConfigs: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      });
    });
  }

  /**
   * Activate a review cycle (change status from DRAFT to ACTIVE)
   * Validates no overlapping active cycles exist
   */
  async activate(id: string, companyId: string) {
    console.log(`▶️ Activating review cycle ${id} for company ${companyId}`);

    // Verify cycle exists and belongs to company
    const cycle = await this.findOne(id, companyId);

    // Can only activate DRAFT cycles
    if (cycle.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot activate ${cycle.status} cycle. Only DRAFT cycles can be activated.`,
      );
    }

    // Validate no overlapping active cycles
    await this.validateNoOverlap(
      companyId,
      cycle.startDate,
      cycle.endDate,
      id,
    );

    // Validate cycle has at least one config
    if (!cycle.reviewConfigs || cycle.reviewConfigs.length === 0) {
      throw new BadRequestException(
        'Cannot activate cycle without workflow steps',
      );
    }

    const activatedCycle = await this.prisma.reviewCycle.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: {
        reviewConfigs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    // Send cycle started notifications to all employees
    await this.notificationsService
      .sendCycleStartedNotifications(id, companyId)
      .catch((err) =>
        console.error('Failed to send cycle started notifications:', err),
      );

    return activatedCycle;
  }

  /**
   * Complete a review cycle (change status from ACTIVE to COMPLETED)
   */
  async complete(id: string, companyId: string) {
    console.log(`✅ Completing review cycle ${id} for company ${companyId}`);

    // Verify cycle exists and belongs to company
    const cycle = await this.findOne(id, companyId);

    // Can only complete ACTIVE cycles
    if (cycle.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot complete ${cycle.status} cycle. Only ACTIVE cycles can be completed.`,
      );
    }

    return this.prisma.reviewCycle.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: {
        reviewConfigs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Delete a review cycle
   * Can only delete DRAFT cycles
   */
  async delete(id: string, companyId: string) {
    console.log(`🗑️ Deleting review cycle ${id} for company ${companyId}`);

    // Verify cycle exists and belongs to company
    const cycle = await this.findOne(id, companyId);

    // Can only delete DRAFT cycles
    if (cycle.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot delete ${cycle.status} cycle. Only DRAFT cycles can be deleted.`,
      );
    }

    await this.prisma.reviewCycle.delete({
      where: { id },
    });

    return { message: 'Review cycle deleted successfully' };
  }

  /**
   * VALIDATION HELPERS
   */

  /**
   * Validate that start date is before end date
   */
  private validateDates(startDate: Date, endDate: Date) {
    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
  }

  /**
   * Validate that no overlapping active cycles exist
   */
  private async validateNoOverlap(
    companyId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ) {
    const overlapping = await this.prisma.reviewCycle.findFirst({
      where: {
        companyId,
        status: 'ACTIVE',
        ...(excludeId && { id: { not: excludeId } }),
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Cannot activate cycle: overlaps with active cycle "${overlapping.name}" (${overlapping.startDate.toISOString().split('T')[0]} - ${overlapping.endDate.toISOString().split('T')[0]})`,
      );
    }
  }

  /**
   * Validate that all config dates fall within cycle dates
   */
  private validateConfigDates(
    cycleStart: Date,
    cycleEnd: Date,
    configs: ReviewConfigDto[],
  ) {
    // Validate maximum 3 steps
    if (configs.length > 3) {
      throw new BadRequestException('Maximum 3 workflow steps allowed');
    }

    // Validate no duplicate Self Review steps
    const selfReviewSteps = configs.filter((c) => c.reviewType === 'SELF');
    if (selfReviewSteps.length > 1) {
      throw new BadRequestException('Only one Self Review step is allowed');
    }

    for (const config of configs) {
      const configStart = new Date(config.startDate);
      const configEnd = new Date(config.endDate);

      // Validate step dates
      if (configStart >= configEnd) {
        throw new BadRequestException(
          `Step ${config.stepNumber}: start date must be before end date`,
        );
      }

      // Validate step falls within cycle
      if (configStart < cycleStart || configEnd > cycleEnd) {
        throw new BadRequestException(
          `Step ${config.stepNumber} (${config.reviewType}): dates must fall within cycle dates (${cycleStart.toISOString().split('T')[0]} - ${cycleEnd.toISOString().split('T')[0]})`,
        );
      }
    }
  }
}
