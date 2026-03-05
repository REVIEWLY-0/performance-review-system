import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma, QuestionType, ReviewType } from '@prisma/client';
import {
  IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsArray,
  MinLength, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaskDefinitionDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsBoolean()
  required!: boolean;
}

export class CreateQuestionDto {
  @IsEnum(ReviewType)
  reviewType!: ReviewType;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxChars?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDefinitionDto)
  tasks?: TaskDefinitionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxChars?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDefinitionDto)
  tasks?: TaskDefinitionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all questions for a company, optionally filtered by review type
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async findAll(companyId: string, reviewType?: ReviewType, page = 1, limit = 100) {
    console.log(`📋 Fetching questions for company: ${companyId}, type: ${reviewType || 'all'}`);

    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where = { companyId, ...(reviewType && { reviewType }) };

    const [data, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: [
          { reviewType: 'asc' },
          { order: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: safeLimit,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get a single question by ID
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async findOne(id: string, companyId: string) {
    console.log(`🔍 Fetching question ${id} for company ${companyId}`);

    const question = await this.prisma.question.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return question;
  }

  /**
   * Create a new question
   * CRITICAL: Always set companyId for multi-tenancy
   */
  async create(companyId: string, dto: CreateQuestionDto) {
    console.log(`➕ Creating question for company ${companyId}:`, dto.text.substring(0, 50));

    // If order is not provided, get the next order number for this review type
    let order = dto.order;
    if (order === undefined) {
      const lastQuestion = await this.prisma.question.findFirst({
        where: {
          companyId,
          reviewType: dto.reviewType,
        },
        orderBy: { order: 'desc' },
      });

      order = lastQuestion ? lastQuestion.order + 1 : 0;
    }

    return this.prisma.question.create({
      data: {
        companyId,
        reviewType: dto.reviewType,
        type: dto.type,
        text: dto.text,
        maxChars: dto.maxChars,
        tasks: dto.tasks ? (dto.tasks as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        order,
      },
    });
  }

  /**
   * Update a question
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async update(id: string, companyId: string, dto: UpdateQuestionDto) {
    console.log(`✏️  Updating question ${id} for company ${companyId}`);

    // Verify the question exists and belongs to the company
    await this.findOne(id, companyId);

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.reviewType !== undefined && { reviewType: dto.reviewType }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.maxChars !== undefined && { maxChars: dto.maxChars }),
        ...(dto.order !== undefined && { order: dto.order }),
        // tasks: null clears predefined tasks; undefined means no change
        ...('tasks' in dto && {
          tasks: dto.tasks
            ? (dto.tasks as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
    });
  }

  /**
   * Delete a question
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async delete(id: string, companyId: string) {
    console.log(`🗑️  Deleting question ${id} for company ${companyId}`);

    // Verify the question exists and belongs to the company
    await this.findOne(id, companyId);

    return this.prisma.question.delete({
      where: { id },
    });
  }

  /**
   * Reorder questions within a review type
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async reorder(
    companyId: string,
    reviewType: ReviewType,
    questionIds: string[],
  ) {
    console.log(`🔄 Reordering ${questionIds.length} questions for company ${companyId}, type: ${reviewType}`);

    // Verify all questions belong to the company and review type
    const questions = await this.prisma.question.findMany({
      where: {
        id: { in: questionIds },
        companyId,
        reviewType,
      },
    });

    if (questions.length !== questionIds.length) {
      throw new NotFoundException('Some questions not found or do not belong to this company');
    }

    // Update order for each question
    const updates = questionIds.map((id, index) =>
      this.prisma.question.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return { message: 'Questions reordered successfully' };
  }

  /**
   * Get questions grouped by review type
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async findGroupedByType(companyId: string) {
    console.log(`📊 Fetching grouped questions for company ${companyId}`);

    const { data: questions } = await this.findAll(companyId, undefined, 1, 500);

    // Group by review type
    const grouped = {
      SELF: questions.filter((q) => q.reviewType === 'SELF'),
      MANAGER: questions.filter((q) => q.reviewType === 'MANAGER'),
      PEER: questions.filter((q) => q.reviewType === 'PEER'),
    };

    return grouped;
  }

  /**
   * Duplicate a question
   * CRITICAL: Always set companyId for multi-tenancy
   */
  async duplicate(id: string, companyId: string) {
    console.log(`📋 Duplicating question ${id} for company ${companyId}`);

    const original = await this.findOne(id, companyId);

    // Get the next order number
    const lastQuestion = await this.prisma.question.findFirst({
      where: {
        companyId,
        reviewType: original.reviewType,
      },
      orderBy: { order: 'desc' },
    });

    const nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

    return this.prisma.question.create({
      data: {
        companyId,
        reviewType: original.reviewType,
        type: original.type,
        text: `${original.text} (Copy)`,
        maxChars: original.maxChars,
        tasks: original.tasks !== null ? (original.tasks as Prisma.InputJsonValue) : Prisma.JsonNull,
        order: nextOrder,
      },
    });
  }
}
