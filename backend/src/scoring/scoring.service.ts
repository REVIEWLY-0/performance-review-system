import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DepartmentQuantScoresService } from '../department-quant-scores/department-quant-scores.service';
import { ScoreWeightsService } from '../score-weights/score-weights.service';

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
  quant: number | null;
}

export interface ReviewCounts {
  self_reviews: number;
  manager_reviews: number;
  peer_reviews: number;
}

export interface WeightConfig {
  quantWeight: number;
  managerWeight: number;
  peerWeight: number;
  selfWeight: number;
  minPeerThreshold: number;
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

// Used when no weight config is available (e.g. unit tests without DB).
// Floating-point 1/3 each ensures symmetric fallback (e.g. (a+b)/2 = exact average).
const EQUAL_WEIGHTS: WeightConfig = {
  quantWeight: 0,
  managerWeight: 100 / 3,
  peerWeight: 100 / 3,
  selfWeight: 100 / 3,
  minPeerThreshold: 3,
};

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ScoringService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private deptQuantScoresService: DepartmentQuantScoresService,
    @Inject(forwardRef(() => ScoreWeightsService))
    private scoreWeightsService: ScoreWeightsService,
  ) {}

  /**
   * Calculate final score for a single employee.
   * Formula: Final = (quantScore × quantWeight + qualScore × qualWeight) / 100
   *   qualScore = Σ(sourceAvg × effectiveWeight) re-normalised over present sources
   */
  async calculateFinalScore(
    employeeId: string,
    cycleId: string,
    companyId: string,
  ): Promise<FinalScoreResponse> {
    console.log(
      `🧮 Calculating final score for employee ${employeeId} in cycle ${cycleId}`,
    );

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

    const [reviews, ratingQuestions, weights, quantScore, override] = await Promise.all([
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
      this.scoreWeightsService.getOrCreate(companyId),
      this.deptQuantScoresService.getEmployeeQuantScore(companyId, cycleId, employeeId),
      this.prisma.scoreOverride.findUnique({
        where: { employeeId_cycleId: { employeeId, cycleId } },
      }),
    ]);

    console.log(`📊 Found ${reviews.length} submitted reviews`);

    const managerOverrides = await this.computeManagerOverrides(
      employeeId, companyId, reviews,
    );

    const result = this.calculateScoreFromData(
      employee,
      cycle,
      reviews,
      ratingQuestions,
      weights,
      quantScore,
      managerOverrides?.overrideManagerAvg,
      managerOverrides?.overridePeerAvg,
    );

    if (override) {
      result.overall_score = override.score;
    }

    if (cycle.status !== 'COMPLETED') {
      result.overall_score = null;
    }

    if (result.overall_score && cycle.status === 'COMPLETED') {
      this.sendScoreNotificationOnce(employeeId, cycleId, result.overall_score);
    }

    return result;
  }

  /**
   * Send score notification only if it hasn't been sent before.
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
        // Unique constraint violation = already sent
      });
  }

  /**
   * Calculate final scores for all employees in a cycle.
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

    const [employees, allReviews, ratingQuestions, allOverrides, weights] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { companyId, role: { in: ['EMPLOYEE', 'MANAGER'] } },
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
        this.scoreWeightsService.getOrCreate(companyId),
      ]);

    console.log(`👥 Found ${employees.length} employees`);

    const reviewsByEmployee = new Map<string, any[]>();
    for (const review of allReviews) {
      const list = reviewsByEmployee.get(review.employeeId) ?? [];
      list.push(review);
      reviewsByEmployee.set(review.employeeId, list);
    }

    const overrideByEmployee = new Map<string, number>();
    for (const ov of allOverrides) {
      overrideByEmployee.set(ov.employeeId, ov.score);
    }

    // Pre-compute quant scores: mean of each employee's departments' scores (M2M).
    const resolvedQuantByEmployee = await this.deptQuantScoresService.buildEmployeeQuantMap(
      companyId,
      cycleId,
      employees.map((e) => e.id),
    );

    // Pre-fetch CEO and build direct-reports map for manager-path scoring (avoids N+1).
    const ceoUser = await (this.prisma.user as any).findFirst({
      where: { companyId, isCeo: true },
      select: { id: true },
    });

    // directReportsMap: managerId → Set of direct-report userIds
    const directReportsMap = new Map<string, Set<string>>();
    for (const emp of employees) {
      if ((emp as any).managerId) {
        const mgr = (emp as any).managerId as string;
        if (!directReportsMap.has(mgr)) directReportsMap.set(mgr, new Set());
        directReportsMap.get(mgr)!.add(emp.id);
      }
    }

    const scores: FinalScoreResponse[] = [];
    for (const employee of employees) {
      try {
        const empReviews = reviewsByEmployee.get(employee.id) ?? [];
        const quantScore = resolvedQuantByEmployee.get(employee.id) ?? null;

        let overrideManagerAvg: number | null | undefined;
        let overridePeerAvg: number | null | undefined;

        const reportIds = directReportsMap.get(employee.id);
        if (reportIds && reportIds.size > 0) {
          // Manager path: CEO downward review → manager slot
          overrideManagerAvg = null;
          if (ceoUser) {
            const ceoReview = allReviews.find(
              (r) =>
                r.reviewerId === ceoUser.id &&
                r.employeeId === employee.id &&
                (r.reviewType === 'DOWNWARD' || r.reviewType === 'MANAGER'),
            );
            if (ceoReview) {
              const ratings: number[] = (ceoReview.answers as any[])
                .filter((a: any) => a.rating != null)
                .map((a: any) => a.rating as number);
              overrideManagerAvg = ratings.length > 0
                ? ratings.reduce((s, v) => s + v, 0) / ratings.length
                : null;
            }
          }

          // Upward reviews from direct reports → peer slot
          const upward = allReviews.filter(
            (r) =>
              r.employeeId === employee.id &&
              reportIds.has(r.reviewerId) &&
              (r.reviewType === 'MANAGER' || r.reviewType === 'DOWNWARD'),
          );
          overridePeerAvg = null;
          if (upward.length > 0) {
            const avgs: number[] = upward
              .map((rev: any) => {
                const rs: number[] = (rev.answers as any[])
                  .filter((a: any) => a.rating != null)
                  .map((a: any) => a.rating as number);
                return rs.length > 0 ? rs.reduce((s, v) => s + v, 0) / rs.length : null;
              })
              .filter((v): v is number => v !== null);
            overridePeerAvg = avgs.length > 0
              ? avgs.reduce((s, v) => s + v, 0) / avgs.length
              : null;
          }
        }

        const result = this.calculateScoreFromData(
          employee,
          cycle,
          empReviews,
          ratingQuestions,
          weights,
          quantScore,
          overrideManagerAvg,
          overridePeerAvg,
        );
        if (overrideByEmployee.has(employee.id)) {
          result.overall_score = overrideByEmployee.get(employee.id)!;
        }
        scores.push(result);
      } catch (err: any) {
        console.error(
          `Error calculating score for ${employee.name}:`,
          err.message,
        );
      }
    }

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
   * For a manager employee: compute the two override averages needed for the
   * manager-path qual score.
   *   overrideManagerAvg — average rating from the CEO's submitted DOWNWARD review
   *                        of this manager (null if CEO unset or review not submitted)
   *   overridePeerAvg    — average rating across all UPWARD reviews submitted by
   *                        this manager's direct reports (null if none)
   *
   * Returns undefined for both values when the employee has no direct reports
   * (i.e. is not a manager), signalling the caller to use the standard path.
   */
  private async computeManagerOverrides(
    employeeId: string,
    companyId: string,
    allReviews: any[],
  ): Promise<{ overrideManagerAvg: number | null; overridePeerAvg: number | null } | null> {
    // Check if this employee is a manager (has direct reports)
    const directReports = await this.prisma.user.findMany({
      where: { managerId: employeeId, companyId },
      select: { id: true },
    });
    if (directReports.length === 0) return null;

    // Find the CEO for this company
    const ceo = await (this.prisma.user as any).findFirst({
      where: { companyId, isCeo: true },
      select: { id: true },
    });

    // CEO downward review of this manager
    let overrideManagerAvg: number | null = null;
    if (ceo) {
      const ceoReview = allReviews.find(
        (r) =>
          r.reviewerId === ceo.id &&
          r.employeeId === employeeId &&
          (r.reviewType === 'DOWNWARD' || r.reviewType === 'MANAGER') &&
          r.status === 'SUBMITTED',
      );
      if (ceoReview) {
        const ratings: number[] = (ceoReview.answers as any[])
          .filter((a: any) => a.rating != null)
          .map((a: any) => a.rating as number);
        overrideManagerAvg = ratings.length > 0
          ? ratings.reduce((s, v) => s + v, 0) / ratings.length
          : null;
      }
    }

    // Upward reviews: MANAGER/DOWNWARD reviews submitted by direct reports of this manager
    const directReportIds = new Set(directReports.map((r) => r.id));
    const upwardReviews = allReviews.filter(
      (r) =>
        r.employeeId === employeeId &&
        directReportIds.has(r.reviewerId) &&
        (r.reviewType === 'MANAGER' || r.reviewType === 'DOWNWARD') &&
        r.status === 'SUBMITTED',
    );

    let overridePeerAvg: number | null = null;
    if (upwardReviews.length > 0) {
      const perReviewAvgs: number[] = upwardReviews
        .map((rev: any) => {
          const ratings: number[] = (rev.answers as any[])
            .filter((a: any) => a.rating != null)
            .map((a: any) => a.rating as number);
          return ratings.length > 0
            ? ratings.reduce((s: number, v: number) => s + v, 0) / ratings.length
            : null;
        })
        .filter((v): v is number => v !== null);
      overridePeerAvg = perReviewAvgs.length > 0
        ? perReviewAvgs.reduce((s, v) => s + v, 0) / perReviewAvgs.length
        : null;
    }

    return { overrideManagerAvg, overridePeerAvg };
  }

  /**
   * Pure in-memory score calculation.
   *
   * Formula:
   *   qualScore  = Σ(sourceAvg × effectiveWeight) / 100  (re-normalised over present sources)
   *   finalScore = (quantScore × quantWeight + qualScore × qualWeight) / 100
   *
   * When weights/quantScore are omitted (e.g. unit tests), falls back to equal-weight
   * averaging of whichever qualitative sources are present, with no quant component.
   */
  calculateScoreFromData(
    employee: { id: string; name: string },
    cycle: { id: string; name: string },
    reviews: any[],
    ratingQuestions: any[],
    weights?: WeightConfig | null,
    quantScore?: number | null,
    overrideManagerAvg?: number | null,
    overridePeerAvg?: number | null,
  ): FinalScoreResponse {
    const cfg = weights ?? EQUAL_WEIGHTS;
    const quant = quantScore ?? null;

    const selfReview = reviews.find((r) => r.reviewType === 'SELF');
    const managerReviews = reviews.filter(
      (r) => r.reviewType === 'DOWNWARD' || r.reviewType === 'MANAGER',
    );
    const peerReviews = reviews.filter((r) => r.reviewType === 'PEER');

    const warnings: string[] = [];

    // Average all non-null ratings in a review. Works with both embedded question objects
    // (production) and plain { questionId, rating } answers (unit tests).
    const ratingAvg = (review: any): number | null => {
      const ratings: number[] = (review.answers as any[])
        .filter((a) => a.rating != null)
        .map((a) => a.rating as number);
      return ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;
    };

    const selfAvg = selfReview ? ratingAvg(selfReview) : null;

    // For managers: caller pre-computes CEO downward avg (overrideManagerAvg) and
    // upward-review avg from direct reports (overridePeerAvg). When provided they
    // replace the default review-type-based classification; undefined means use default.
    const managerAvg: number | null = overrideManagerAvg !== undefined
      ? overrideManagerAvg
      : (() => {
          const ratings = managerReviews
            .map(ratingAvg)
            .filter((v): v is number => v !== null);
          return ratings.length > 0
            ? ratings.reduce((s, v) => s + v, 0) / ratings.length
            : null;
        })();

    const peerAvg: number | null = overridePeerAvg !== undefined
      ? overridePeerAvg
      : (() => {
          const ratings = peerReviews
            .map(ratingAvg)
            .filter((v): v is number => v !== null);
          return ratings.length > 0
            ? ratings.reduce((s, v) => s + v, 0) / ratings.length
            : null;
        })();

    // Per-question breakdown (best-effort; only for display, not for score calculation)
    const byQuestion: QuestionScore[] = ratingQuestions.map((question) => {
      const selfScore =
        selfReview?.answers.find((a: any) => a.questionId === question.id)
          ?.rating ?? null;

      const managerScores = managerReviews
        .map((r: any) =>
          r.answers.find((a: any) => a.questionId === question.id)?.rating,
        )
        .filter((s: any): s is number => s != null);

      const peerScores = peerReviews
        .map((r: any) =>
          r.answers.find((a: any) => a.questionId === question.id)?.rating,
        )
        .filter((s: any): s is number => s != null);

      const mgAvg =
        managerScores.length > 0
          ? managerScores.reduce((s: number, n: number) => s + n, 0) /
            managerScores.length
          : null;
      const prAvg =
        peerScores.length > 0
          ? peerScores.reduce((s: number, n: number) => s + n, 0) /
            peerScores.length
          : null;
      const combined = [selfScore, mgAvg, prAvg].filter(
        (s): s is number => s !== null,
      );
      const overallAvg =
        combined.length > 0
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

    // ── Qualitative score with re-normalisation ──────────────────────────────
    // Build map of present qual sources and their configured weights
    const qualSources: { value: number; weight: number; label: string }[] = [];
    if (selfAvg != null) qualSources.push({ value: selfAvg, weight: cfg.selfWeight, label: 'self' });
    if (managerAvg != null) qualSources.push({ value: managerAvg, weight: cfg.managerWeight, label: 'manager' });
    if (peerAvg != null) qualSources.push({ value: peerAvg, weight: cfg.peerWeight, label: 'peer' });

    if (!managerAvg) warnings.push('No manager reviews available');
    if (!peerAvg) warnings.push('No peer reviews available');

    let qualScore: number | null = null;
    if (qualSources.length > 0) {
      const totalWeight = qualSources.reduce((s, src) => s + src.weight, 0);
      if (totalWeight > 0) {
        qualScore =
          qualSources.reduce((s, src) => s + src.value * (src.weight / totalWeight), 0);
      }
    }

    if (qualSources.length === 0) {
      warnings.push('No reviews available to calculate score');
    } else if (qualSources.length === 1 && selfAvg != null) {
      warnings.push('Only self-review available - final score may not be representative');
    }

    // ── Final score: quant + qual blend ─────────────────────────────────────
    let overallScore: number | null = null;
    if (qualScore != null || quant != null) {
      // Re-normalise quant/qual weights if one side is missing
      const qw = quant != null ? cfg.quantWeight : 0;
      const lw = qualScore != null ? (100 - cfg.quantWeight) : 0;
      const totalW = qw + lw;
      if (totalW > 0) {
        const parts: number[] = [];
        if (quant != null) parts.push(quant * (qw / totalW));
        if (qualScore != null) parts.push(qualScore * (lw / totalW));
        overallScore = parts.reduce((s, v) => s + v, 0);
      }
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      cycleId: cycle.id,
      cycleName: cycle.name,
      overall_score: overallScore != null ? Number(overallScore.toFixed(2)) : null,
      breakdown: {
        self: selfAvg != null ? Number(selfAvg.toFixed(2)) : null,
        manager: managerAvg != null ? Number(managerAvg.toFixed(2)) : null,
        peer: peerAvg != null ? Number(peerAvg.toFixed(2)) : null,
        quant: quant != null ? Number(quant.toFixed(2)) : null,
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
