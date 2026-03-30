import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReviewStatus, ReviewType } from '@prisma/client';

// ============================================================================
// DTOs
// ============================================================================

import {
  IsString, IsOptional, IsNumber, IsArray, ValidateNested, MaxLength, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  textAnswer?: string | null;
}

export class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

export class SubmitReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}

// Response DTOs

export interface QuestionWithAnswer {
  id: string;
  reviewType: string;
  type: string;
  text: string;
  maxChars: number | null;
  order: number;
  tasks?: any[] | null;
  answer?: {
    id: string;
    rating: number | null;
    textAnswer: string | null;
  } | null;
}

export interface SelfReviewResponse {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewType: string;
    status: string;
    updatedAt: Date;
  };
  questions: QuestionWithAnswer[];
}

export interface EmployeeToReview {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  reviewStatus: string; // Status of manager's review (NOT_STARTED, DRAFT, SUBMITTED)
}

export interface ManagerReviewResponse {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewType: string;
    status: string;
    updatedAt: Date;
  };
  questions: QuestionWithAnswer[];
  employeeSelfReview: {
    status: string;
    questions: QuestionWithAnswer[];
  } | null;
  employee: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PeerReviewResponse {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewType: string;
    status: string;
    updatedAt: Date;
  };
  questions: QuestionWithAnswer[];
  employee: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or create self-review for employee in a cycle
   * Returns review with questions and existing answers
   * CRITICAL: Filter by companyId through reviewCycle relation
   */
  async findOrCreateSelfReview(
    userId: string,
    companyId: string,
    cycleId: string,
  ): Promise<SelfReviewResponse> {
    console.log(
      `📝 Finding/creating self-review for user ${userId} in cycle ${cycleId}`,
    );

    // Verify cycle exists, belongs to company, and is ACTIVE
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE', // Only allow reviews for active cycles
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Find or create review
    let review = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId: userId,
        reviewerId: userId, // SELF review: employee === reviewer
        reviewType: 'SELF',
      },
      include: {
        answers: true,
      },
    });

    if (!review) {
      console.log(`➕ Creating new self-review record`);
      review = await this.prisma.review.create({
        data: {
          reviewCycleId: cycleId,
          employeeId: userId,
          reviewerId: userId,
          reviewType: 'SELF',
          status: 'NOT_STARTED',
        },
        include: {
          answers: true,
        },
      });
    }

    // Get all SELF questions for this company
    const questions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'SELF',
      },
      orderBy: { order: 'asc' },
    });

    // Map questions with their answers
    const questionsWithAnswers: QuestionWithAnswer[] = questions.map((q) => {
      const answer = review.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        reviewType: q.reviewType,
        type: q.type,
        text: q.text,
        maxChars: q.maxChars,
        order: q.order,
        tasks: q.tasks as any[] | null,
        answer: answer
          ? {
              id: answer.id,
              rating: answer.rating,
              textAnswer: answer.textAnswer,
            }
          : null,
      };
    });

    return {
      review: {
        id: review.id,
        reviewCycleId: review.reviewCycleId,
        employeeId: review.employeeId,
        reviewType: review.reviewType,
        status: review.status,
        updatedAt: review.updatedAt,
      },
      questions: questionsWithAnswers,
    };
  }

  /**
   * Save draft answers (auto-save)
   * Updates review status to DRAFT if currently NOT_STARTED
   * Uses upsert pattern for answers
   */
  async saveDraft(
    reviewId: string,
    userId: string,
    companyId: string,
    dto: SaveDraftDto,
  ) {
    console.log(
      `💾 Saving draft for review ${reviewId}, ${dto.answers.length} answers`,
    );

    // Verify review exists and belongs to user
    const review = await this.verifyReviewAccess(
      reviewId,
      userId,
      companyId,
    );

    // Validate review is not already submitted
    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Cannot modify submitted review');
    }

    // Use transaction to update answers and review status atomically
    return this.prisma.$transaction(async (prisma) => {
      // Upsert each answer
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: {
            reviewId_questionId: {
              reviewId: reviewId,
              questionId: answerDto.questionId,
            },
          },
          create: {
            reviewId: reviewId,
            questionId: answerDto.questionId,
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
          update: {
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
        });
      }

      // Update review status to DRAFT if currently NOT_STARTED
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: review.status === 'NOT_STARTED' ? 'DRAFT' : review.status,
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Draft saved successfully',
        updatedAt: updatedReview.updatedAt,
      };
    });
  }

  /**
   * Submit review (final submission)
   * Validates all required questions are answered
   * Changes status to SUBMITTED (immutable after this)
   */
  async submitReview(
    reviewId: string,
    userId: string,
    companyId: string,
    dto: SubmitReviewDto,
  ) {
    console.log(`✅ Submitting review ${reviewId}`);

    // Verify review exists and belongs to user
    const review = await this.verifyReviewAccess(
      reviewId,
      userId,
      companyId,
    );

    // Validate review is not already submitted
    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Review already submitted');
    }

    // Get all required questions
    const questions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'SELF',
      },
    });

    // Validate all questions have answers
    const answeredQuestionIds = new Set(
      dto.answers.map((a) => a.questionId),
    );

    const missingAnswers = questions.filter(
      (q) => !answeredQuestionIds.has(q.id),
    );

    if (missingAnswers.length > 0) {
      throw new BadRequestException(
        `Missing answers for ${missingAnswers.length} required question(s)`,
      );
    }

    // Use transaction to save answers and submit
    return this.prisma.$transaction(async (prisma) => {
      // Upsert all answers
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: {
            reviewId_questionId: {
              reviewId: reviewId,
              questionId: answerDto.questionId,
            },
          },
          create: {
            reviewId: reviewId,
            questionId: answerDto.questionId,
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
          update: {
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
        });
      }

      // Update review status to SUBMITTED
      const submittedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: 'SUBMITTED',
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Review submitted successfully',
        review: submittedReview,
      };
    });
  }

  /**
   * Helper: Verify review exists and user has access
   * CRITICAL: Multi-tenancy check through reviewCycle
   */
  private async verifyReviewAccess(
    reviewId: string,
    userId: string,
    companyId: string,
  ) {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        employeeId: userId,
        reviewType: 'SELF',
        reviewCycle: {
          companyId: companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found or access denied');
    }

    return review;
  }

  // ============================================================================
  // Manager Review Methods
  // ============================================================================

  /**
   * Get list of employees assigned to this manager for review
   * Returns employees with their review status (NOT_STARTED, DRAFT, SUBMITTED)
   * CRITICAL: Filter by companyId through reviewCycle relation
   */
  async getEmployeesToReview(
    managerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(
      `📋 Getting employees to review for manager ${managerId} in cycle ${cycleId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Get upward assignments: this user reviewing someone with MANAGER role
    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        employee: { role: 'MANAGER' }, // upward only — the person being reviewed is a manager
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy filter
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
    });

    // Batch fetch all manager reviews for this reviewer in one query
    const existingReviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewType: 'MANAGER',
      },
      select: { employeeId: true, status: true },
    });

    // Build lookup map for O(1) access per assignment
    const reviewStatusMap = new Map(
      existingReviews.map((r) => [r.employeeId, r.status]),
    );

    return assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      department: assignment.employee.department,
      reviewStatus: reviewStatusMap.get(assignment.employeeId) ?? 'NOT_STARTED',
    }));
  }

  /**
   * Get or create manager review for a specific employee
   * Returns manager review form + employee's self-review answers
   * CRITICAL: Filter by companyId and verify manager is assigned
   */
  async findOrCreateManagerReview(
    managerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<ManagerReviewResponse> {
    console.log(
      `📝 Finding/creating manager review for employee ${employeeId} by manager ${managerId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Verify manager is assigned to review this employee
    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        'Not assigned to review this employee or access denied',
      );
    }

    // Get employee details
    const employee = await this.prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId, // CRITICAL: Multi-tenancy
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    // Find or create manager review
    let review = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewType: 'MANAGER',
      },
      include: {
        answers: true,
      },
    });

    if (!review) {
      console.log(`➕ Creating new manager review record`);
      review = await this.prisma.review.create({
        data: {
          reviewCycleId: cycleId,
          employeeId,
          reviewerId: managerId,
          reviewType: 'MANAGER',
          status: 'NOT_STARTED',
        },
        include: {
          answers: true,
        },
      });
    }

    // Get all MANAGER questions for this company
    const questions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'MANAGER',
      },
      orderBy: { order: 'asc' },
    });

    // Map questions with manager's answers
    const questionsWithAnswers: QuestionWithAnswer[] = questions.map((q) => {
      const answer = review.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        reviewType: q.reviewType,
        type: q.type,
        text: q.text,
        maxChars: q.maxChars,
        order: q.order,
        tasks: q.tasks as any[] | null,
        answer: answer
          ? {
              id: answer.id,
              rating: answer.rating,
              textAnswer: answer.textAnswer,
            }
          : null,
      };
    });

    // Get employee's self-review with answers
    const selfReview = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: employeeId, // Self-review
        reviewType: 'SELF',
      },
      include: {
        answers: true,
      },
    });

    // Get SELF questions to map with employee's answers
    const selfQuestions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'SELF',
      },
      orderBy: { order: 'asc' },
    });

    const employeeSelfReview = selfReview
      ? {
          status: selfReview.status,
          questions: selfQuestions.map((q) => {
            const answer = selfReview.answers.find(
              (a) => a.questionId === q.id,
            );
            return {
              id: q.id,
              reviewType: q.reviewType,
              type: q.type,
              text: q.text,
              maxChars: q.maxChars,
              order: q.order,
              tasks: q.tasks as any[] | null,
              answer: answer
                ? {
                    id: answer.id,
                    rating: answer.rating,
                    textAnswer: answer.textAnswer,
                  }
                : null,
            };
          }),
        }
      : null;

    return {
      review: {
        id: review.id,
        reviewCycleId: review.reviewCycleId,
        employeeId: review.employeeId,
        reviewerId: review.reviewerId,
        reviewType: review.reviewType,
        status: review.status,
        updatedAt: review.updatedAt,
      },
      questions: questionsWithAnswers,
      employeeSelfReview,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      },
    };
  }

  /**
   * Save or submit manager review
   * Similar to self-review but validates manager assignment
   */
  async saveManagerReview(
    reviewId: string,
    managerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(
      `${submit ? '✅ Submitting' : '💾 Saving'} manager review ${reviewId}`,
    );

    // Verify review exists and manager has access
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        reviewerId: managerId, // Manager is the reviewer
        reviewType: 'MANAGER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found or access denied');
    }

    // Validate review is not already submitted
    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Cannot modify submitted review');
    }

    // If submitting, validate all questions are answered
    if (submit) {
      const questions = await this.prisma.question.findMany({
        where: {
          companyId,
          reviewType: 'MANAGER',
        },
      });

      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter(
        (q) => !answeredQuestionIds.has(q.id),
      );

      if (missingAnswers.length > 0) {
        throw new BadRequestException(
          `Missing answers for ${missingAnswers.length} required question(s)`,
        );
      }
    }

    // Use transaction to save answers and update status
    return this.prisma.$transaction(async (prisma) => {
      // Upsert all answers
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: {
            reviewId_questionId: {
              reviewId: reviewId,
              questionId: answerDto.questionId,
            },
          },
          create: {
            reviewId: reviewId,
            questionId: answerDto.questionId,
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
          update: {
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
        });
      }

      // Determine new status
      let newStatus: ReviewStatus = review.status;
      if (submit) {
        newStatus = 'SUBMITTED';
      } else if (review.status === 'NOT_STARTED') {
        newStatus = 'DRAFT';
      }

      // Update review status
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      return {
        message: submit
          ? 'Review submitted successfully'
          : 'Draft saved successfully',
        updatedAt: updatedReview.updatedAt,
      };
    });
  }

  // ============================================================================
  // Peer Review Methods
  // ============================================================================

  /**
   * Get list of employees assigned to this peer for review
   * Returns employees with their review status (NOT_STARTED, DRAFT, SUBMITTED)
   * CRITICAL: Filter by companyId through reviewCycle relation
   */
  async getEmployeesToReviewAsPeer(
    peerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(
      `📋 Getting employees to review for peer ${peerId} in cycle ${cycleId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Get reviewer assignments where this user is assigned as PEER
    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: peerId,
        reviewerType: 'PEER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy filter
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
    });

    // Batch fetch all peer reviews for this reviewer in one query
    const existingReviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: peerId,
        reviewType: 'PEER',
      },
      select: { employeeId: true, status: true },
    });

    // Build lookup map for O(1) access per assignment
    const reviewStatusMap = new Map(
      existingReviews.map((r) => [r.employeeId, r.status]),
    );

    return assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      department: assignment.employee.department,
      reviewStatus: reviewStatusMap.get(assignment.employeeId) ?? 'NOT_STARTED',
    }));
  }

  /**
   * Get or create peer review for a specific employee
   * Returns peer review form (does NOT include employee's self-review)
   * CRITICAL: Filter by companyId and verify peer is assigned
   */
  async findOrCreatePeerReview(
    peerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<PeerReviewResponse> {
    console.log(
      `📝 Finding/creating peer review for employee ${employeeId} by peer ${peerId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Verify peer is assigned to review this employee
    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: peerId,
        reviewerType: 'PEER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        'Not assigned to review this employee or access denied',
      );
    }

    // Get employee details
    const employee = await this.prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId, // CRITICAL: Multi-tenancy
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    // Find or create peer review
    let review = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: peerId,
        reviewType: 'PEER',
      },
      include: {
        answers: true,
      },
    });

    if (!review) {
      console.log(`➕ Creating new peer review record`);
      review = await this.prisma.review.create({
        data: {
          reviewCycleId: cycleId,
          employeeId,
          reviewerId: peerId,
          reviewType: 'PEER',
          status: 'NOT_STARTED',
        },
        include: {
          answers: true,
        },
      });
    }

    // Get all PEER questions for this company
    const questions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'PEER',
      },
      orderBy: { order: 'asc' },
    });

    // Map questions with peer's answers
    const questionsWithAnswers: QuestionWithAnswer[] = questions.map((q) => {
      const answer = review.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        reviewType: q.reviewType,
        type: q.type,
        text: q.text,
        maxChars: q.maxChars,
        order: q.order,
        tasks: q.tasks as any[] | null,
        answer: answer
          ? {
              id: answer.id,
              rating: answer.rating,
              textAnswer: answer.textAnswer,
            }
          : null,
      };
    });

    return {
      review: {
        id: review.id,
        reviewCycleId: review.reviewCycleId,
        employeeId: review.employeeId,
        reviewerId: review.reviewerId,
        reviewType: review.reviewType,
        status: review.status,
        updatedAt: review.updatedAt,
      },
      questions: questionsWithAnswers,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      },
    };
  }

  // ============================================================================
  // Downward Review Methods (Manager evaluating team member)
  // ============================================================================

  /**
   * Get list of employees assigned to this manager for downward review
   * Returns employees with their downward review status (NOT_STARTED, DRAFT, SUBMITTED)
   * CRITICAL: Filter by companyId through reviewCycle relation
   */
  async getEmployeesToReviewDownward(
    managerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(
      `📋 Getting employees for downward review by manager ${managerId} in cycle ${cycleId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Get downward assignments: this manager reviewing employees (EMPLOYEE role only)
    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        employee: { role: 'EMPLOYEE' }, // downward only — the person being reviewed is an employee
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy filter
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
    });

    // Batch fetch all DOWNWARD reviews for this reviewer in one query
    const existingReviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewType: 'DOWNWARD',
      },
      select: { employeeId: true, status: true },
    });

    // Build lookup map for O(1) access per assignment
    const reviewStatusMap = new Map(
      existingReviews.map((r) => [r.employeeId, r.status]),
    );

    return assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      department: assignment.employee.department,
      reviewStatus: reviewStatusMap.get(assignment.employeeId) ?? 'NOT_STARTED',
    }));
  }

  /**
   * Get or create downward review for a specific employee
   * Returns downward review form + employee's self-review answers for context
   * CRITICAL: Filter by companyId and verify manager is assigned
   */
  async findOrCreateDownwardReview(
    managerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<ManagerReviewResponse> {
    console.log(
      `📝 Finding/creating downward review for employee ${employeeId} by manager ${managerId}`,
    );

    // Verify cycle exists and belongs to company
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
        status: 'ACTIVE',
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        'Review cycle not found, not active, or access denied',
      );
    }

    // Verify manager is assigned to review this employee
    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        'Not assigned to review this employee or access denied',
      );
    }

    // Get employee details
    const employee = await this.prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId, // CRITICAL: Multi-tenancy
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    // Find or create downward review
    let review = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewType: 'DOWNWARD',
      },
      include: {
        answers: true,
      },
    });

    if (!review) {
      console.log(`➕ Creating new downward review record`);
      review = await this.prisma.review.create({
        data: {
          reviewCycleId: cycleId,
          employeeId,
          reviewerId: managerId,
          reviewType: 'DOWNWARD',
          status: 'NOT_STARTED',
        },
        include: {
          answers: true,
        },
      });
    }

    // Get all DOWNWARD questions for this company
    const questions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'DOWNWARD',
      },
      orderBy: { order: 'asc' },
    });

    // Map questions with manager's answers
    const questionsWithAnswers: QuestionWithAnswer[] = questions.map((q) => {
      const answer = review.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        reviewType: q.reviewType,
        type: q.type,
        text: q.text,
        maxChars: q.maxChars,
        order: q.order,
        tasks: q.tasks as any[] | null,
        answer: answer
          ? {
              id: answer.id,
              rating: answer.rating,
              textAnswer: answer.textAnswer,
            }
          : null,
      };
    });

    // Get employee's self-review with answers (for context)
    const selfReview = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: employeeId, // Self-review
        reviewType: 'SELF',
      },
      include: {
        answers: true,
      },
    });

    // Get SELF questions to map with employee's answers
    const selfQuestions = await this.prisma.question.findMany({
      where: {
        companyId,
        reviewType: 'SELF',
      },
      orderBy: { order: 'asc' },
    });

    const employeeSelfReview = selfReview
      ? {
          status: selfReview.status,
          questions: selfQuestions.map((q) => {
            const answer = selfReview.answers.find(
              (a) => a.questionId === q.id,
            );
            return {
              id: q.id,
              reviewType: q.reviewType,
              type: q.type,
              text: q.text,
              maxChars: q.maxChars,
              order: q.order,
              tasks: q.tasks as any[] | null,
              answer: answer
                ? {
                    id: answer.id,
                    rating: answer.rating,
                    textAnswer: answer.textAnswer,
                  }
                : null,
            };
          }),
        }
      : null;

    return {
      review: {
        id: review.id,
        reviewCycleId: review.reviewCycleId,
        employeeId: review.employeeId,
        reviewerId: review.reviewerId,
        reviewType: review.reviewType,
        status: review.status,
        updatedAt: review.updatedAt,
      },
      questions: questionsWithAnswers,
      employeeSelfReview,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      },
    };
  }

  /**
   * Save or submit downward review
   * Similar to manager review but validates/saves using DOWNWARD type
   */
  async saveDownwardReview(
    reviewId: string,
    managerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(
      `${submit ? '✅ Submitting' : '💾 Saving'} downward review ${reviewId}`,
    );

    // Verify review exists and manager has access
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        reviewerId: managerId, // Manager is the reviewer
        reviewType: 'DOWNWARD',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found or access denied');
    }

    // Validate review is not already submitted
    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Cannot modify submitted review');
    }

    // If submitting, validate all questions are answered
    if (submit) {
      const questions = await this.prisma.question.findMany({
        where: {
          companyId,
          reviewType: 'DOWNWARD',
        },
      });

      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter(
        (q) => !answeredQuestionIds.has(q.id),
      );

      if (missingAnswers.length > 0) {
        throw new BadRequestException(
          `Missing answers for ${missingAnswers.length} required question(s)`,
        );
      }
    }

    // Use transaction to save answers and update status
    return this.prisma.$transaction(async (prisma) => {
      // Upsert all answers
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: {
            reviewId_questionId: {
              reviewId: reviewId,
              questionId: answerDto.questionId,
            },
          },
          create: {
            reviewId: reviewId,
            questionId: answerDto.questionId,
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
          update: {
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
        });
      }

      // Determine new status
      let newStatus: ReviewStatus = review.status;
      if (submit) {
        newStatus = 'SUBMITTED';
      } else if (review.status === 'NOT_STARTED') {
        newStatus = 'DRAFT';
      }

      // Update review status
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      return {
        message: submit
          ? 'Review submitted successfully'
          : 'Draft saved successfully',
        updatedAt: updatedReview.updatedAt,
      };
    });
  }

  // ============================================================================
  // Peer Review Methods
  // ============================================================================

  /**
   * Save or submit peer review
   * Similar to manager review but for PEER type
   */
  async savePeerReview(
    reviewId: string,
    peerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(
      `${submit ? '✅ Submitting' : '💾 Saving'} peer review ${reviewId}`,
    );

    // Verify review exists and peer has access
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        reviewerId: peerId, // Peer is the reviewer
        reviewType: 'PEER',
        reviewCycle: {
          companyId, // CRITICAL: Multi-tenancy
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found or access denied');
    }

    // Validate review is not already submitted
    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Cannot modify submitted review');
    }

    // If submitting, validate all questions are answered
    if (submit) {
      const questions = await this.prisma.question.findMany({
        where: {
          companyId,
          reviewType: 'PEER',
        },
      });

      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter(
        (q) => !answeredQuestionIds.has(q.id),
      );

      if (missingAnswers.length > 0) {
        throw new BadRequestException(
          `Missing answers for ${missingAnswers.length} required question(s)`,
        );
      }
    }

    // Use transaction to save answers and update status
    return this.prisma.$transaction(async (prisma) => {
      // Upsert all answers
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: {
            reviewId_questionId: {
              reviewId: reviewId,
              questionId: answerDto.questionId,
            },
          },
          create: {
            reviewId: reviewId,
            questionId: answerDto.questionId,
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
          update: {
            rating: answerDto.rating,
            textAnswer: answerDto.textAnswer,
          },
        });
      }

      // Determine new status
      let newStatus: ReviewStatus = review.status;
      if (submit) {
        newStatus = 'SUBMITTED';
      } else if (review.status === 'NOT_STARTED') {
        newStatus = 'DRAFT';
      }

      // Update review status
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      return {
        message: submit
          ? 'Review submitted successfully'
          : 'Draft saved successfully',
        updatedAt: updatedReview.updatedAt,
      };
    });
  }

  // ============================================================================
  // Admin — View All Review Responses for an Employee
  // ============================================================================

  /**
   * Return all SUBMITTED reviews for a specific employee in a cycle.
   * PEER reviewer identities are anonymised; all other reviewer names are included.
   * Answers include question text, type, rating, and text/task responses.
   */
  async getAdminEmployeeReviews(
    adminCompanyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    // Verify cycle belongs to this company (no status restriction — admins can view completed cycles)
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId: adminCompanyId },
      select: { id: true, name: true },
    });
    if (!cycle) throw new NotFoundException('Review cycle not found or access denied');

    // Verify employee belongs to the same company
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId: adminCompanyId },
      select: { id: true, name: true, email: true, department: true },
    });
    if (!employee) throw new NotFoundException('Employee not found or access denied');

    // Fetch all SUBMITTED reviews for this employee, with reviewer info + full answers
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        status: 'SUBMITTED',
        reviewCycle: { companyId: adminCompanyId }, // multi-tenancy guard
      },
      include: {
        reviewer: { select: { id: true, name: true } },
        answers: {
          include: {
            question: {
              select: { id: true, text: true, type: true, order: true, tasks: true },
            },
          },
          orderBy: { question: { order: 'asc' } },
        },
      },
      orderBy: { reviewType: 'asc' },
    });

    // Shape response — anonymise PEER reviewers
    const entries = reviews.map((review) => {
      const isPeer = review.reviewType === 'PEER';
      return {
        reviewId: review.id,
        reviewType: review.reviewType,
        submittedAt: review.updatedAt,
        reviewer: {
          id: isPeer ? null : review.reviewer.id,
          name: isPeer ? null : review.reviewer.name,
          isAnonymous: isPeer,
        },
        answers: review.answers.map((a) => ({
          questionId: a.questionId,
          questionText: a.question.text,
          questionType: a.question.type,
          questionOrder: a.question.order,
          tasks: a.question.tasks,
          rating: a.rating,
          textAnswer: a.textAnswer,
        })),
      };
    });

    // Include any existing manual score override
    const override = await this.prisma.scoreOverride.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
      select: { score: true, note: true, createdAt: true },
    });

    return { employee, cycle, reviews: entries, scoreOverride: override ?? null };
  }

  // ============================================================================
  // Admin — Manual Score Override
  // ============================================================================

  async setScoreOverride(
    adminCompanyId: string,
    adminId: string,
    cycleId: string,
    employeeId: string,
    score: number,
    note?: string,
  ) {
    // Verify employee and cycle belong to admin's company
    const [employee, cycle] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: employeeId, companyId: adminCompanyId }, select: { id: true, name: true } }),
      this.prisma.reviewCycle.findFirst({ where: { id: cycleId, companyId: adminCompanyId }, select: { id: true, name: true } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!cycle) throw new NotFoundException('Review cycle not found');

    const override = await this.prisma.scoreOverride.upsert({
      where: { employeeId_cycleId: { employeeId, cycleId } },
      create: { companyId: adminCompanyId, employeeId, cycleId, score, note: note ?? null, createdBy: adminId },
      update: { score, note: note ?? null },
    });

    return { message: 'Score override saved', override: { score: override.score, note: override.note } };
  }

  async deleteScoreOverride(
    adminCompanyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    // Verify ownership
    const existing = await this.prisma.scoreOverride.findFirst({
      where: { employeeId, cycleId, companyId: adminCompanyId },
    });
    if (!existing) throw new NotFoundException('No override found');

    await this.prisma.scoreOverride.delete({ where: { employeeId_cycleId: { employeeId, cycleId } } });
    return { message: 'Score override removed' };
  }
}
