import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReviewStatus, ReviewType } from '@prisma/client';

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
  reviewStatus: string;
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

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async findOrCreateSelfReview(
    userId: string,
    companyId: string,
    cycleId: string,
  ): Promise<SelfReviewResponse> {
    console.log(`📝 Finding/creating self-review for user ${userId} in cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    let review = await this.prisma.review.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId: userId,
        reviewerId: userId,
        reviewType: 'SELF',
      },
      include: { answers: true },
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
        include: { answers: true },
      });
    }

    const questions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'SELF' },
      orderBy: { order: 'asc' },
    });

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
        answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
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

  async saveDraft(
    reviewId: string,
    userId: string,
    companyId: string,
    dto: SaveDraftDto,
  ) {
    console.log(`💾 Saving draft for review ${reviewId}, ${dto.answers.length} answers`);

    const review = await this.verifyReviewAccess(reviewId, userId, companyId);

    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Cannot modify submitted review');
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: { reviewId_questionId: { reviewId, questionId: answerDto.questionId } },
          create: { reviewId, questionId: answerDto.questionId, rating: answerDto.rating, textAnswer: answerDto.textAnswer },
          update: { rating: answerDto.rating, textAnswer: answerDto.textAnswer },
        });
      }

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: review.status === 'NOT_STARTED' ? 'DRAFT' : review.status,
          updatedAt: new Date(),
        },
      });

      return { message: 'Draft saved successfully', updatedAt: updatedReview.updatedAt };
    });
  }

  async submitReview(
    reviewId: string,
    userId: string,
    companyId: string,
    dto: SubmitReviewDto,
  ) {
    console.log(`✅ Submitting review ${reviewId}`);

    const review = await this.verifyReviewAccess(reviewId, userId, companyId);

    if (review.status === 'SUBMITTED') {
      throw new BadRequestException('Review already submitted');
    }

    const questions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'SELF' },
    });

    const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
    const missingAnswers = questions.filter((q) => !answeredQuestionIds.has(q.id));

    if (missingAnswers.length > 0) {
      throw new BadRequestException(`Missing answers for ${missingAnswers.length} required question(s)`);
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: { reviewId_questionId: { reviewId, questionId: answerDto.questionId } },
          create: { reviewId, questionId: answerDto.questionId, rating: answerDto.rating, textAnswer: answerDto.textAnswer },
          update: { rating: answerDto.rating, textAnswer: answerDto.textAnswer },
        });
      }

      const submittedReview = await prisma.review.update({
        where: { id: reviewId },
        data: { status: 'SUBMITTED', updatedAt: new Date() },
      });

      return { message: 'Review submitted successfully', review: submittedReview };
    });
  }

  private async verifyReviewAccess(reviewId: string, userId: string, companyId: string) {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        employeeId: userId,
        reviewType: 'SELF',
        reviewCycle: { companyId },
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

  async getEmployeesToReview(
    managerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(`📋 Getting employees to review for manager ${managerId} in cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    // Upward reviews: current user is reviewing their own manager
    // First find who the current user's manager is
    const currentUser = await this.prisma.user.findFirst({
      where: { id: managerId, companyId },
      select: { managerId: true },
    });

    if (!currentUser?.managerId) return [];

    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        employeeId: currentUser.managerId, // Only reviewing own manager (upward)
        reviewCycle: { companyId },
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    const existingReviews = await this.prisma.review.findMany({
      where: { reviewCycleId: cycleId, reviewerId: managerId, reviewType: 'MANAGER' },
      select: { employeeId: true, status: true },
    });

    const reviewStatusMap = new Map(existingReviews.map((r) => [r.employeeId, r.status]));

    return assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      department: assignment.employee.department,
      reviewStatus: reviewStatusMap.get(assignment.employeeId) ?? 'NOT_STARTED',
    }));
  }

  async findOrCreateManagerReview(
    managerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<ManagerReviewResponse> {
    console.log(`📝 Finding/creating manager review for employee ${employeeId} by manager ${managerId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        reviewCycle: { companyId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Not assigned to review this employee or access denied');
    }

    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, email: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    let review = await this.prisma.review.findFirst({
      where: { reviewCycleId: cycleId, employeeId, reviewerId: managerId, reviewType: 'MANAGER' },
      include: { answers: true },
    });

    if (!review) {
      console.log(`➕ Creating new manager review record`);
      review = await this.prisma.review.create({
        data: { reviewCycleId: cycleId, employeeId, reviewerId: managerId, reviewType: 'MANAGER', status: 'NOT_STARTED' },
        include: { answers: true },
      });
    }

    const questions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'MANAGER' },
      orderBy: { order: 'asc' },
    });

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
        answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
      };
    });

    const selfReview = await this.prisma.review.findFirst({
      where: { reviewCycleId: cycleId, employeeId, reviewerId: employeeId, reviewType: 'SELF' },
      include: { answers: true },
    });

    const selfQuestions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'SELF' },
      orderBy: { order: 'asc' },
    });

    const employeeSelfReview = selfReview
      ? {
          status: selfReview.status,
          questions: selfQuestions.map((q) => {
            const answer = selfReview.answers.find((a) => a.questionId === q.id);
            return {
              id: q.id,
              reviewType: q.reviewType,
              type: q.type,
              text: q.text,
              maxChars: q.maxChars,
              order: q.order,
              tasks: q.tasks as any[] | null,
              answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
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
      employee: { id: employee.id, name: employee.name, email: employee.email },
    };
  }

  async saveManagerReview(
    reviewId: string,
    managerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(`${submit ? '✅ Submitting' : '💾 Saving'} manager review ${reviewId}`);

    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, reviewerId: managerId, reviewType: 'MANAGER', reviewCycle: { companyId } },
    });

    if (!review) throw new NotFoundException('Review not found or access denied');
    if (review.status === 'SUBMITTED') throw new BadRequestException('Cannot modify submitted review');

    if (submit) {
      const questions = await this.prisma.question.findMany({ where: { companyId, reviewType: 'MANAGER' } });
      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter((q) => !answeredQuestionIds.has(q.id));
      if (missingAnswers.length > 0) {
        throw new BadRequestException(`Missing answers for ${missingAnswers.length} required question(s)`);
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: { reviewId_questionId: { reviewId, questionId: answerDto.questionId } },
          create: { reviewId, questionId: answerDto.questionId, rating: answerDto.rating, textAnswer: answerDto.textAnswer },
          update: { rating: answerDto.rating, textAnswer: answerDto.textAnswer },
        });
      }

      let newStatus: ReviewStatus = review.status;
      if (submit) newStatus = 'SUBMITTED';
      else if (review.status === 'NOT_STARTED') newStatus = 'DRAFT';

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      return { message: submit ? 'Review submitted successfully' : 'Draft saved successfully', updatedAt: updatedReview.updatedAt };
    });
  }

  // ============================================================================
  // Downward Review Methods
  // ============================================================================

  async getEmployeesToReviewDownward(
    managerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(`📋 Getting direct reports for downward review by manager ${managerId} in cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    // Downward reviews: find all MANAGER assignments where this manager reviews employees
    // Exclude assignments where the employee is this manager's own manager (those are upward)
    const currentManager = await this.prisma.user.findFirst({
      where: { id: managerId, companyId },
      select: { managerId: true },
    });

    const whereClause: any = {
      reviewCycleId: cycleId,
      reviewerId: managerId,
      reviewerType: 'MANAGER',
      reviewCycle: { companyId },
    };

    // Exclude the assignment for reviewing own manager (upward direction)
    if (currentManager?.managerId) {
      whereClause.NOT = { employeeId: currentManager.managerId };
    }

    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    if (assignments.length === 0) return [];

    const existingReviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: managerId,
        reviewType: { in: ['DOWNWARD', 'MANAGER'] },
      },
      select: { employeeId: true, status: true },
    });

    const reviewStatusMap = new Map(existingReviews.map((r) => [r.employeeId, r.status]));

    return assignments.map((a) => ({
      id: a.employee.id,
      name: a.employee.name,
      email: a.employee.email,
      department: a.employee.department,
      reviewStatus: reviewStatusMap.get(a.employeeId) ?? 'NOT_STARTED',
    }));

  }
  async findOrCreateDownwardReview(
    managerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<ManagerReviewResponse> {
    console.log(`📝 Finding/creating downward review for employee ${employeeId} by manager ${managerId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    // Validate access via ReviewerAssignment (not org chart)
    // This covers both org-chart direct reports and manually assigned employees
    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: managerId,
        reviewerType: 'MANAGER',
        reviewCycle: { companyId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Not assigned to review this employee or access denied');
    }
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, email: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    let review = await this.prisma.review.findFirst({
      where: { reviewCycleId: cycleId, employeeId, reviewerId: managerId, reviewType: 'DOWNWARD' },
      include: { answers: true },
    });

    if (!review) {
      console.log(`➕ Creating new downward review record`);
      review = await this.prisma.review.create({
        data: { reviewCycleId: cycleId, employeeId, reviewerId: managerId, reviewType: 'DOWNWARD', status: 'NOT_STARTED' },
        include: { answers: true },
      });
    }

    const questions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'DOWNWARD' },
      orderBy: { order: 'asc' },
    });

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
        answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
      };
    });

    const selfReview = await this.prisma.review.findFirst({
      where: { reviewCycleId: cycleId, employeeId, reviewerId: employeeId, reviewType: 'SELF' },
      include: { answers: true },
    });

    const selfQuestions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'SELF' },
      orderBy: { order: 'asc' },
    });

    const employeeSelfReview = selfReview
      ? {
          status: selfReview.status,
          questions: selfQuestions.map((q) => {
            const answer = selfReview.answers.find((a) => a.questionId === q.id);
            return {
              id: q.id,
              reviewType: q.reviewType,
              type: q.type,
              text: q.text,
              maxChars: q.maxChars,
              order: q.order,
              tasks: q.tasks as any[] | null,
              answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
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
      employee: { id: employee.id, name: employee.name, email: employee.email },
    };
  }

  async saveDownwardReview(
    reviewId: string,
    managerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(`${submit ? '✅ Submitting' : '💾 Saving'} downward review ${reviewId}`);

    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, reviewerId: managerId, reviewType: 'DOWNWARD', reviewCycle: { companyId } },
    });

    if (!review) throw new NotFoundException('Review not found or access denied');
    if (review.status === 'SUBMITTED') throw new BadRequestException('Cannot modify submitted review');

    if (submit) {
      const questions = await this.prisma.question.findMany({ where: { companyId, reviewType: 'DOWNWARD' } });
      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter((q) => !answeredQuestionIds.has(q.id));
      if (missingAnswers.length > 0) {
        throw new BadRequestException(`Missing answers for ${missingAnswers.length} required question(s)`);
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: { reviewId_questionId: { reviewId, questionId: answerDto.questionId } },
          create: { reviewId, questionId: answerDto.questionId, rating: answerDto.rating, textAnswer: answerDto.textAnswer },
          update: { rating: answerDto.rating, textAnswer: answerDto.textAnswer },
        });
      }

      let newStatus: ReviewStatus = review.status;
      if (submit) newStatus = 'SUBMITTED';
      else if (review.status === 'NOT_STARTED') newStatus = 'DRAFT';

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      return { message: submit ? 'Review submitted successfully' : 'Draft saved successfully', updatedAt: updatedReview.updatedAt };
    });
  }

  // ============================================================================
  // Peer Review Methods
  // ============================================================================

  async getEmployeesToReviewAsPeer(
    peerId: string,
    companyId: string,
    cycleId: string,
  ): Promise<EmployeeToReview[]> {
    console.log(`📋 Getting employees to review for peer ${peerId} in cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: {
        reviewCycleId: cycleId,
        reviewerId: peerId,
        reviewerType: 'PEER',
        reviewCycle: { companyId },
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    });

    const existingReviews = await this.prisma.review.findMany({
      where: { reviewCycleId: cycleId, reviewerId: peerId, reviewType: 'PEER' },
      select: { employeeId: true, status: true },
    });

    const reviewStatusMap = new Map(existingReviews.map((r) => [r.employeeId, r.status]));

    return assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      department: assignment.employee.department,
      reviewStatus: reviewStatusMap.get(assignment.employeeId) ?? 'NOT_STARTED',
    }));
  }

  async findOrCreatePeerReview(
    peerId: string,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<PeerReviewResponse> {
    console.log(`📝 Finding/creating peer review for employee ${employeeId} by peer ${peerId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId, status: 'ACTIVE' },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found, not active, or access denied');
    }

    const assignment = await this.prisma.reviewerAssignment.findFirst({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        reviewerId: peerId,
        reviewerType: 'PEER',
        reviewCycle: { companyId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Not assigned to review this employee or access denied');
    }

    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, email: true },
    });

    if (!employee) throw new NotFoundException('Employee not found or access denied');

    let review = await this.prisma.review.findFirst({
      where: { reviewCycleId: cycleId, employeeId, reviewerId: peerId, reviewType: 'PEER' },
      include: { answers: true },
    });

    if (!review) {
      console.log(`➕ Creating new peer review record`);
      review = await this.prisma.review.create({
        data: { reviewCycleId: cycleId, employeeId, reviewerId: peerId, reviewType: 'PEER', status: 'NOT_STARTED' },
        include: { answers: true },
      });
    }

    const questions = await this.prisma.question.findMany({
      where: { companyId, reviewType: 'PEER' },
      orderBy: { order: 'asc' },
    });

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
        answer: answer ? { id: answer.id, rating: answer.rating, textAnswer: answer.textAnswer } : null,
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
      employee: { id: employee.id, name: employee.name, email: employee.email },
    };
  }

  async savePeerReview(
    reviewId: string,
    peerId: string,
    companyId: string,
    dto: SaveDraftDto | SubmitReviewDto,
    submit: boolean = false,
  ) {
    console.log(`${submit ? '✅ Submitting' : '💾 Saving'} peer review ${reviewId}`);

    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, reviewerId: peerId, reviewType: 'PEER', reviewCycle: { companyId } },
    });

    if (!review) throw new NotFoundException('Review not found or access denied');
    if (review.status === 'SUBMITTED') throw new BadRequestException('Cannot modify submitted review');

    if (submit) {
      const questions = await this.prisma.question.findMany({ where: { companyId, reviewType: 'PEER' } });
      const answeredQuestionIds = new Set(dto.answers.map((a) => a.questionId));
      const missingAnswers = questions.filter((q) => !answeredQuestionIds.has(q.id));
      if (missingAnswers.length > 0) {
        throw new BadRequestException(`Missing answers for ${missingAnswers.length} required question(s)`);
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const answerDto of dto.answers) {
        await prisma.answer.upsert({
          where: { reviewId_questionId: { reviewId, questionId: answerDto.questionId } },
          create: { reviewId, questionId: answerDto.questionId, rating: answerDto.rating, textAnswer: answerDto.textAnswer },
          update: { rating: answerDto.rating, textAnswer: answerDto.textAnswer },
        });
      }

      let newStatus: ReviewStatus = review.status;
      if (submit) newStatus = 'SUBMITTED';
      else if (review.status === 'NOT_STARTED') newStatus = 'DRAFT';

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      return { message: submit ? 'Review submitted successfully' : 'Draft saved successfully', updatedAt: updatedReview.updatedAt };
    });
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  async getAdminEmployeeReviews(
    adminCompanyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId: adminCompanyId },
      select: { id: true, name: true },
    });
    if (!cycle) throw new NotFoundException('Review cycle not found or access denied');

    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId: adminCompanyId },
      select: { id: true, name: true, email: true, department: true },
    });
    if (!employee) throw new NotFoundException('Employee not found or access denied');

    const reviews = await this.prisma.review.findMany({
      where: {
        reviewCycleId: cycleId,
        employeeId,
        status: 'SUBMITTED',
        reviewCycle: { companyId: adminCompanyId },
      },
      include: {
        reviewer: { select: { id: true, name: true } },
        answers: {
          include: {
            question: { select: { id: true, text: true, type: true, order: true, tasks: true } },
          },
          orderBy: { question: { order: 'asc' } },
        },
      },
      orderBy: { reviewType: 'asc' },
    });

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

    const override = await this.prisma.scoreOverride.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
      select: { score: true, note: true, createdAt: true },
    });

    return { employee, cycle, reviews: entries, scoreOverride: override ?? null };
  }

  async setScoreOverride(
    adminCompanyId: string,
    adminId: string,
    cycleId: string,
    employeeId: string,
    score: number,
    note?: string,
  ) {
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
    const existing = await this.prisma.scoreOverride.findFirst({
      where: { employeeId, cycleId, companyId: adminCompanyId },
    });
    if (!existing) throw new NotFoundException('No override found');

    await this.prisma.scoreOverride.delete({ where: { employeeId_cycleId: { employeeId, cycleId } } });
    return { message: 'Score override removed' };
  }
}