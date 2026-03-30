import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ============================================================================
// DTOs
// ============================================================================

export interface QuestionScore {
  questionId: string;
  questionText: string;
  questionType: string;
  selfScore: number | null;
  managerScores: number[];
  peerScores: number[];
  managerAvg: number | null;
  peerAvg: number | null;
  overallAvg: number | null;
}

export interface ScoreBreakdown {
  self: number | null;
  manager: number | null;
  peer: number | null;
}

export interface ReviewCounts {
  self_reviews: number;
  manager_reviews: number;
  peer_reviews: number;
}

export interface FinalScoreResponse {
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  overall_score: number | null;
  breakdown: ScoreBreakdown;
  by_question: QuestionScore[];
  review_counts: ReviewCounts;
  warnings: string[];
}

export interface AllScoresResponse {
  cycleId: string;
  cycleName: string;
  calculatedAt: Date;
  scores: FinalScoreResponse[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ScoringService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Calculate final score for a single employee.
   * Formula: (Self + Avg(Managers) + Avg(Peers)) / 3
   * CRITICAL: Only uses SUBMITTED reviews, filtered by companyId.
   */
  async calculateFinalScore(
    employeeId: string,
    cycleId: string,
    companyId: string,
  ): Promise<FinalScoreResponse> {
    console.log(
      `🧮 Calculating final score for employee ${employeeId} in cycle ${cycleId}`,
    );

    // Verify cycle and employee exist
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found or access denied');
    }

    // Fetch reviews and rating questions in parallel
    const [reviews, ratingQuestions] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          employeeId,
          reviewCycleId: cycleId,
          status: 'SUBMITTED',
          reviewCycle: { companyId },
        },
        include: { answers: { include: { question: true } } },
      }),
      this.prisma.question.findMany({
        where: { companyId, type: 'RATING' },
        orderBy: { order: 'asc' },
      }),
    ]);

    console.log(`📊 Found ${reviews.length} submitted reviews`);

    const result = this.calculateScoreFromData(
      employee,
      cycle,
      reviews,
      ratingQuestions,
    );

    // Scores are only visible once the cycle is officially completed.
    // Return null overall_score for active/draft cycles so every employee's
    // score unlocks at the same moment — not as their individual reviews trickle in.
    if (cycle.status !== 'COMPLETED') {
      result.overall_score = null;
    }

    // Only notify when the cycle is officially complete — never during an active cycle
    if (result.overall_score && cycle.status === 'COMPLETED') {
      this.sendScoreNotificationOnce(employeeId, cycleId, result.overall_score);
    }

    return result;
  }

  /**
   * Send score notification only if it hasn't been sent before.
   * Uses score_notifications table as a dedup guard.
   */
  private sendScoreNotificationOnce(
    employeeId: string,
    cycleId: string,
    score: number,
  ): void {
    this.prisma.scoreNotification
      .create({ data: { employeeId, cycleId } })
      .then(() =>
        this.notificationsService
          .sendScoreAvailableNotification(employeeId, cycleId, score)
          .catch((err) =>
            console.error('Failed to send score notification:', err),
          ),
      )
      .catch(() => {
        // Unique constraint violation = already sent — silently ignore
      });
  }

  /**
   * Calculate final scores for all employees in a cycle.
   * Uses 4 total DB queries regardless of employee count (vs N*4 previously).
   */
  async calculateAllScores(
    cycleId: string,
    companyId: string,
  ): Promise<AllScoresResponse> {
    console.log(`🧮 Calculating all scores for cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    // Batch load everything in parallel — 3 queries total
    const [employees, allReviews, ratingQuestions] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId, role: 'EMPLOYEE' },
        orderBy: { name: 'asc' },
      }),
      this.prisma.review.findMany({
        where: {
          reviewCycleId: cycleId,
          status: 'SUBMITTED',
          reviewCycle: { companyId },
        },
        include: { answers: { include: { question: true } } },
      }),
      this.prisma.question.findMany({
        where: { companyId, type: 'RATING' },
        orderBy: { order: 'asc' },
      }),
    ]);

    console.log(`👥 Found ${employees.length} employees`);

    // Group reviews by employeeId for O(1) lookup
    const reviewsByEmployee = new Map<string, any[]>();
    for (const review of allReviews) {
      const list = reviewsByEmployee.get(review.employeeId) ?? [];
      list.push(review);
      reviewsByEmployee.set(review.employeeId, list);
    }

    // Calculate all scores in memory — no additional DB calls
    const scores: FinalScoreResponse[] = [];
    for (const employee of employees) {
      try {
        const empReviews = reviewsByEmployee.get(employee.id) ?? [];
        const result = this.calculateScoreFromData(
          employee,
          cycle,
          empReviews,
          ratingQuestions,
        );
        // Scores only visible once cycle is completed — null them out otherwise
        if (cycle.status !== 'COMPLETED') {
          result.overall_score = null;
        }
        scores.push(result);
      } catch (err: any) {
        console.error(
          `Error calculating score for ${employee.name}:`,
          err.message,
        );
      }
    }

    // Only notify when the cycle is officially complete — never during an active cycle
    if (cycle.status === 'COMPLETED') {
      for (const score of scores) {
        if (score.overall_score) {
          this.sendScoreNotificationOnce(score.employeeId, cycleId, score.overall_score);
        }
      }
    }

    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      calculatedAt: new Date(),
      scores,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Pure in-memory score calculation from pre-loaded data.
   * No DB calls — safe to call in a loop without performance concern.
   */
  private calculateScoreFromData(
    employee: { id: string; name: string },
    cycle: { id: string; name: string },
    reviews: any[],
    ratingQuestions: any[],
  ): FinalScoreResponse {
    const selfReview = reviews.find((r) => r.reviewType === 'SELF');
    const managerReviews = reviews.filter((r) => r.reviewType === 'DOWNWARD');
    const peerReviews = reviews.filter((r) => r.reviewType === 'PEER' || r.reviewType === 'MANAGER');

    const warnings: string[] = [];

    // Calculate per-question scores
    const byQuestion: QuestionScore[] = ratingQuestions.map((question) => {
      const selfAnswer = selfReview?.answers.find(
        (a: any) => a.questionId === question.id,
      );
      const selfScore = selfAnswer?.rating || null;

      const managerScores = managerReviews
        .map((review: any) => {
          const answer = review.answers.find(
            (a: any) => a.questionId === question.id,
          );
          return answer?.rating;
        })
        .filter(
          (score: any): score is number =>
            score !== null && score !== undefined,
        );

      const peerScores = peerReviews
        .map((review: any) => {
          const answer = review.answers.find(
            (a: any) => a.questionId === question.id,
          );
          return answer?.rating;
        })
        .filter(
          (score: any): score is number =>
            score !== null && score !== undefined,
        );

      const managerAvg =
        managerScores.length > 0
          ? managerScores.reduce((sum: number, s: number) => sum + s, 0) /
            managerScores.length
          : null;

      const peerAvg =
        peerScores.length > 0
          ? peerScores.reduce((sum: number, s: number) => sum + s, 0) /
            peerScores.length
          : null;

      const scores = [selfScore, managerAvg, peerAvg].filter(
        (s): s is number => s !== null,
      );
      const overallAvg =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : null;

      return {
        questionId: question.id,
        questionText: question.text,
        questionType: question.reviewType,
        selfScore,
        managerScores,
        peerScores,
        managerAvg: managerAvg ? Number(managerAvg.toFixed(2)) : null,
        peerAvg: peerAvg ? Number(peerAvg.toFixed(2)) : null,
        overallAvg: overallAvg ? Number(overallAvg.toFixed(2)) : null,
      };
    });

    // Calculate overall category averages
    const selfScores = byQuestion
      .map((q) => q.selfScore)
      .filter((s): s is number => s !== null);
    const selfAvg =
      selfScores.length > 0
        ? selfScores.reduce((sum, s) => sum + s, 0) / selfScores.length
        : null;

    const managerAvgs = byQuestion
      .map((q) => q.managerAvg)
      .filter((s): s is number => s !== null);
    const managerOverallAvg =
      managerAvgs.length > 0
        ? managerAvgs.reduce((sum, s) => sum + s, 0) / managerAvgs.length
        : null;

    const peerAvgs = byQuestion
      .map((q) => q.peerAvg)
      .filter((s): s is number => s !== null);
    const peerOverallAvg =
      peerAvgs.length > 0
        ? peerAvgs.reduce((sum, s) => sum + s, 0) / peerAvgs.length
        : null;

    // Final overall score with fallback logic
    let overallScore: number | null = null;
    const availableScores = [selfAvg, managerOverallAvg, peerOverallAvg].filter(
      (s): s is number => s !== null,
    );

    if (availableScores.length === 3) {
      overallScore =
        availableScores.reduce((sum, s) => sum + s, 0) /
        availableScores.length;
    } else if (availableScores.length === 2) {
      overallScore =
        availableScores.reduce((sum, s) => sum + s, 0) /
        availableScores.length;
      if (!managerOverallAvg) {
        warnings.push('No manager reviews available - using self and peer only');
      } else if (!peerOverallAvg) {
        warnings.push('No peer reviews available - using self and manager only');
      }
    } else if (availableScores.length === 1) {
      overallScore = selfAvg;
      warnings.push(
        'Only self-review available - final score may not be representative',
      );
    } else {
      warnings.push('No reviews available to calculate score');
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      cycleId: cycle.id,
      cycleName: cycle.name,
      overall_score: overallScore ? Number(overallScore.toFixed(2)) : null,
      breakdown: {
        self: selfAvg ? Number(selfAvg.toFixed(2)) : null,
        manager: managerOverallAvg
          ? Number(managerOverallAvg.toFixed(2))
          : null,
        peer: peerOverallAvg ? Number(peerOverallAvg.toFixed(2)) : null,
      },
      by_question: byQuestion,
      review_counts: {
        self_reviews: selfReview ? 1 : 0,
        manager_reviews: managerReviews.length,
        peer_reviews: peerReviews.length,
      },
      warnings,
    };
  }
}
