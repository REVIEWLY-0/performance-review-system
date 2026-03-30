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

    // Check for manual override first
    const override = await this.prisma.scoreOverride.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
    });

    const result = this.calculateScoreFromData(
      employee,
      cycle,
      reviews,
      ratingQuestions,
    );

    if (override) {
      result.overall_score = override.score;
    }

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

    // Batch load everything in parallel — 4 queries total
    const [employees, allReviews, ratingQuestions, allOverrides] = await Promise.all([
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
      this.prisma.scoreOverride.findMany({
        where: { cycleId, companyId },
        select: { employeeId: true, score: true },
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

    // Map overrides by employeeId for O(1) lookup
    const overrideByEmployee = new Map<string, number>();
    for (const ov of allOverrides) {
      overrideByEmployee.set(ov.employeeId, ov.score);
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
        // Apply manual override if set
        if (overrideByEmployee.has(employee.id)) {
          result.overall_score = overrideByEmployee.get(employee.id)!;
        }
        // Admin calculate-all always shows real scores regardless of cycle status
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

    // Helper: average all RATING answers in a review directly from embedded question.type
    // This is the source of truth — avoids cross-referencing with the current question list
    // which may be empty or out of sync with the questions used in the actual reviews.
    const ratingAvg = (review: any): number | null => {
      const ratings: number[] = (review.answers as any[])
        .filter((a) => a.question?.type === 'RATING' && a.rating != null)
        .map((a) => a.rating as number);
      return ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;
    };

    const selfAvg = selfReview ? ratingAvg(selfReview) : null;

    const managerRatings = managerReviews
      .map(ratingAvg)
      .filter((v): v is number => v !== null);
    const managerOverallAvg =
      managerRatings.length > 0
        ? managerRatings.reduce((sum, s) => sum + s, 0) / managerRatings.length
        : null;

    const peerRatings = peerReviews
      .map(ratingAvg)
      .filter((v): v is number => v !== null);
    const peerOverallAvg =
      peerRatings.length > 0
        ? peerRatings.reduce((sum, s) => sum + s, 0) / peerRatings.length
        : null;

    // Build per-question breakdown for API response (best-effort; uses current question list)
    const byQuestion: QuestionScore[] = ratingQuestions.map((question) => {
      const selfScore = selfReview?.answers.find(
        (a: any) => a.questionId === question.id,
      )?.rating ?? null;

      const managerScores = managerReviews
        .map((r: any) => r.answers.find((a: any) => a.questionId === question.id)?.rating)
        .filter((s: any): s is number => s != null);

      const peerScores = peerReviews
        .map((r: any) => r.answers.find((a: any) => a.questionId === question.id)?.rating)
        .filter((s: any): s is number => s != null);

      const mgAvg = managerScores.length > 0
        ? managerScores.reduce((s: number, n: number) => s + n, 0) / managerScores.length
        : null;
      const prAvg = peerScores.length > 0
        ? peerScores.reduce((s: number, n: number) => s + n, 0) / peerScores.length
        : null;
      const combined = [selfScore, mgAvg, prAvg].filter((s): s is number => s !== null);
      const overallAvg = combined.length > 0
        ? combined.reduce((s, n) => s + n, 0) / combined.length
        : null;

      return {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        selfScore,
        managerScores,
        peerScores,
        managerAvg: mgAvg != null ? Number(mgAvg.toFixed(2)) : null,
        peerAvg: prAvg != null ? Number(prAvg.toFixed(2)) : null,
        overallAvg: overallAvg != null ? Number(overallAvg.toFixed(2)) : null,
      };
    });

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
