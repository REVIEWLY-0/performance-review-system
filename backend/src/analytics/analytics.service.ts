import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

// ============================================================================
// DTOs
// ============================================================================

export interface EmployeeScore {
  id: string;
  name: string;
  email: string;
  score: number | null;
}

export interface AdminAnalytics {
  totalEmployees: number;
  activeEmployees: number;
  completionRate: number;
  averageScore: number | null;
  topPerformers: EmployeeScore[];
  pendingReviews: {
    selfReviews: number;
    managerReviews: number;
    peerReviews: number;
  };
  reviewProgress: {
    submitted: number;
    draft: number;
    notStarted: number;
  };
}

export interface ManagerAnalytics {
  teamSize: number;
  teamAverageScore: number | null;
  companyAverageScore: number | null;
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    score: number | null;
    reviewsCompleted: number;
    reviewsTotal: number;
  }>;
  pendingReviews: number;
}

export interface EmployeeAnalytics {
  personalScore: number | null;
  allReviewsComplete: boolean;
  companyAverage: number | null;
  scoreBreakdown: {
    self: number | null;
    manager: number | null;
    peer: number | null;
  };
  pendingTasks: {
    selfReview: boolean;
    peerReviews: number;
    managerReviews: number;
  };
  taskCounts: {
    selfTotal: number;
    peerTotal: number;
    managerTotal: number;
    selfCompleted: number;
    peerCompleted: number;
    managerCompleted: number;
  };
  reviewCounts: {
    self: number;
    manager: number;
    peer: number;
  };
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get admin analytics - company-wide statistics
   */
  async getAdminAnalytics(
    cycleId: string,
    companyId: string,
  ): Promise<AdminAnalytics> {
    console.log(`📊 Getting admin analytics for cycle ${cycleId}`);

    // Verify cycle
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    // Fetch employees and review status counts in parallel (count queries, no heavy includes)
    const [
      allNonAdminUsers,
      submitted,
      draft,
      assignmentCount,
      selfPending,
      managerPending,
      peerPending,
    ] = await Promise.all([
      // All non-admin users (EMPLOYEE + MANAGER) — for totalEmployees display,
      // scoring, and completion rate denominator
      this.prisma.user.findMany({ where: { companyId, role: { not: 'ADMIN' } } }),
      // cycleId already verified to belong to companyId above — no JOIN needed
      this.prisma.review.count({ where: { reviewCycleId: cycleId, status: 'SUBMITTED' } }),
      this.prisma.review.count({ where: { reviewCycleId: cycleId, status: 'DRAFT' } }),
      // Count expected reviews from assignments — this is the true denominator.
      // Using review.count({ where: cycleId }) is wrong because it only counts records
      // that have been created; employees who haven't started yet have no record.
      this.prisma.reviewerAssignment.count({ where: { reviewCycleId: cycleId } }),
      this.prisma.review.count({ where: { reviewCycleId: cycleId, reviewType: 'SELF',    status: { not: 'SUBMITTED' } } }),
      this.prisma.review.count({ where: { reviewCycleId: cycleId, reviewType: { in: ['MANAGER', 'DOWNWARD'] }, status: { not: 'SUBMITTED' } } }),
      this.prisma.review.count({ where: { reviewCycleId: cycleId, reviewType: 'PEER',    status: { not: 'SUBMITTED' } } }),
    ]);

    // Scoring uses EMPLOYEE role only (managers are not scored as reviewees)
    const allEmployees = allNonAdminUsers.filter((u) => u.role === 'EMPLOYEE');

    // Calculate scores using a single batch query internally
    const employeeScores = await this.calculateAllEmployeeScores(
      cycleId,
      companyId,
      allEmployees,
    );

    const validScores = employeeScores.filter((e) => e.score !== null);
    const averageScore =
      validScores.length > 0
        ? validScores.reduce((sum, e) => sum + e.score!, 0) / validScores.length
        : null;

    const topPerformers = [...employeeScores]
      .filter((e) => e.score !== null)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    // totalExpected = reviewer assignments + 1 self-review per non-admin user
    // Using allNonAdminUsers (not just EMPLOYEE) so manager self-reviews don't push > 100%
    const totalExpected = assignmentCount + allNonAdminUsers.length;
    const notStarted = Math.max(0, totalExpected - submitted - draft);
    const completionRate = totalExpected > 0 ? Math.min(100, (submitted / totalExpected) * 100) : 0;

    return {
      totalEmployees: allNonAdminUsers.length,
      activeEmployees: validScores.length,
      completionRate: Math.round(completionRate),
      averageScore: averageScore ? Number(averageScore.toFixed(2)) : null,
      topPerformers,
      pendingReviews: {
        selfReviews: selfPending,
        managerReviews: managerPending,
        peerReviews: peerPending,
      },
      reviewProgress: {
        submitted,
        draft,
        notStarted,
      },
    };
  }

  /**
   * Get manager analytics - team statistics
   */
  async getManagerAnalytics(
    managerId: string,
    cycleId: string,
    companyId: string,
  ): Promise<ManagerAnalytics> {
    console.log(`📊 Getting manager analytics for manager ${managerId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    // Get team members (employees this manager is assigned to review — downward only)
    const [assignments, directReportCount] = await Promise.all([
      this.prisma.reviewerAssignment.findMany({
        where: {
          reviewCycleId: cycleId,
          reviewerId: managerId,
          reviewerType: 'MANAGER',
          employee: { role: 'EMPLOYEE' }, // downward only — direct reports
          // cycleId already verified to belong to companyId above
        },
        include: { employee: true },
      }),
      // Count actual direct reports (managerId relationship) for the Team Size stat
      this.prisma.user.count({ where: { managerId, companyId } }),
    ]);

    const teamMemberIds = assignments.map((a) => a.employeeId);

    // Batch load all team reviews + company employees + pending count in parallel
    const [allTeamReviews, allSubmittedReviews, allEmployees, pendingReviews] =
      await Promise.all([
        // Lightweight review count tracking
        this.prisma.review.findMany({
          where: {
            reviewCycleId: cycleId,
            employeeId: { in: teamMemberIds },
          },
          select: { employeeId: true, status: true },
        }),
        // Submitted reviews with answers for score calculation
        this.prisma.review.findMany({
          where: {
            reviewCycleId: cycleId,
            employeeId: { in: teamMemberIds },
            status: 'SUBMITTED',
          },
          include: { answers: { include: { question: true } } },
        }),
        this.prisma.user.findMany({ where: { companyId, role: 'EMPLOYEE' } }),
        this.prisma.review.count({
          where: {
            reviewCycleId: cycleId,
            reviewerId: managerId,
            reviewType: 'DOWNWARD',
            status: { not: 'SUBMITTED' },
          },
        }),
      ]);

    // Group by employeeId for O(1) lookup
    const reviewCountMap = new Map<
      string,
      { total: number; completed: number }
    >();
    for (const review of allTeamReviews) {
      const curr = reviewCountMap.get(review.employeeId) ?? {
        total: 0,
        completed: 0,
      };
      curr.total++;
      if (review.status === 'SUBMITTED') curr.completed++;
      reviewCountMap.set(review.employeeId, curr);
    }

    const submittedByEmployee = new Map<string, any[]>();
    for (const review of allSubmittedReviews) {
      const list = submittedByEmployee.get(review.employeeId) ?? [];
      list.push(review);
      submittedByEmployee.set(review.employeeId, list);
    }

    const cycleCompleted = cycle.status === 'COMPLETED';

    const teamScores = assignments.map((assignment) => {
      const counts = reviewCountMap.get(assignment.employeeId) ?? {
        total: 0,
        completed: 0,
      };
      const empReviews = submittedByEmployee.get(assignment.employeeId) ?? [];
      return {
        id: assignment.employee.id,
        name: assignment.employee.name,
        email: assignment.employee.email,
        score: cycleCompleted ? this.scoreFromReviews(empReviews) : null,
        reviewsCompleted: counts.completed,
        reviewsTotal: counts.total,
      };
    });

    // Team average
    const validTeamScores = teamScores.filter((t) => t.score !== null);
    const teamAverageScore =
      validTeamScores.length > 0
        ? validTeamScores.reduce((sum, t) => sum + t.score!, 0) /
          validTeamScores.length
        : null;

    // Company average (uses batched calculateAllEmployeeScores)
    const companyScores = await this.calculateAllEmployeeScores(
      cycleId,
      companyId,
      allEmployees,
    );
    const validCompanyScores = companyScores.filter((e) => e.score !== null);
    const companyAverageScore =
      validCompanyScores.length > 0
        ? validCompanyScores.reduce((sum, e) => sum + e.score!, 0) /
          validCompanyScores.length
        : null;

    return {
      teamSize: directReportCount,
      teamAverageScore: cycleCompleted && teamAverageScore
        ? Number(teamAverageScore.toFixed(2))
        : null,
      companyAverageScore: cycleCompleted && companyAverageScore
        ? Number(companyAverageScore.toFixed(2))
        : null,
      teamMembers: teamScores,
      pendingReviews,
    };
  }

  /**
   * Get employee analytics - personal statistics
   */
  async getEmployeeAnalytics(
    employeeId: string,
    cycleId: string,
    companyId: string,
  ): Promise<EmployeeAnalytics> {
    console.log(`📊 Getting employee analytics for employee ${employeeId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    // Load personal reviews, peer assignment counts, company employees, and required types in parallel
    const [reviews, peerAssignments, completedPeerReviews, managerUpwardAssignments, completedManagerUpwardReviews, allEmployees, assignedManagerReviewers, assignedPeerReviewers, requiredTypeConfigs] =
      await Promise.all([
        this.prisma.review.findMany({
          where: { reviewCycleId: cycleId, employeeId },
          include: { answers: { include: { question: true } } },
        }),
        this.prisma.reviewerAssignment.count({
          where: {
            reviewCycleId: cycleId,
            reviewerId: employeeId,
            reviewerType: 'PEER',
          },
        }),
        this.prisma.review.count({
          where: {
            reviewCycleId: cycleId,
            reviewerId: employeeId,
            reviewType: 'PEER',
            status: 'SUBMITTED',
          },
        }),
        // Outgoing: upward MANAGER reviews this user needs to write — only where the reviewed person is a MANAGER
        this.prisma.reviewerAssignment.count({
          where: {
            reviewCycleId: cycleId,
            reviewerId: employeeId,
            reviewerType: 'MANAGER',
            employee: { role: 'MANAGER' },
          },
        }),
        // Completed upward manager reviews
        this.prisma.review.count({
          where: {
            reviewCycleId: cycleId,
            reviewerId: employeeId,
            reviewType: 'MANAGER',
            status: 'SUBMITTED',
          },
        }),
        this.prisma.user.findMany({ where: { companyId, role: 'EMPLOYEE' } }),
        // Incoming: how many downward (MANAGER-role) reviewers are assigned to review this employee
        this.prisma.reviewerAssignment.count({
          where: { reviewCycleId: cycleId, employeeId, reviewerType: 'MANAGER', reviewer: { role: 'MANAGER' } },
        }),
        // Incoming: how many peer reviewers are assigned to review this employee
        this.prisma.reviewerAssignment.count({
          where: { reviewCycleId: cycleId, employeeId, reviewerType: 'PEER' },
        }),
        // Which base types are required for this company
        this.prisma.reviewTypeConfig.findMany({
          where: { companyId, isRequired: true, isActive: true },
          select: { baseType: true },
        }),
      ]);

    // Use pre-loaded reviews for score calculation (no extra DB call)
    const submittedReviews = reviews.filter((r) => r.status === 'SUBMITTED');
    const personalScore = this.scoreFromReviews(submittedReviews);

    const selfReview = submittedReviews.find((r) => r.reviewType === 'SELF');
    const managerReviews = submittedReviews.filter(
      (r) => r.reviewType === 'DOWNWARD' || r.reviewType === 'MANAGER',
    );
    const peerReviews = submittedReviews.filter((r) => r.reviewType === 'PEER');

    const breakdown = {
      self: selfReview ? this.ratingAvgFromAnswers(selfReview.answers) : null,
      manager:
        managerReviews.length > 0
          ? this.multiReviewRatingAvg(managerReviews)
          : null,
      peer:
        peerReviews.length > 0 ? this.multiReviewRatingAvg(peerReviews) : null,
    };

    // Company average uses batched calculateAllEmployeeScores
    const companyScores = await this.calculateAllEmployeeScores(
      cycleId,
      companyId,
      allEmployees,
    );
    const validScores = companyScores.filter((e) => e.score !== null);
    const companyAverage =
      validScores.length > 0
        ? validScores.reduce((sum, e) => sum + e.score!, 0) / validScores.length
        : null;

    const hasSelfReview = reviews.some(
      (r) => r.reviewType === 'SELF' && r.status === 'SUBMITTED',
    );

    // Score is only visible once all *required* review types have at least one submission.
    // Optional types (isRequired=false) do not block the score.
    const requiredBaseTypes = new Set(requiredTypeConfigs.map((c) => c.baseType));

    const selfRequired = requiredBaseTypes.has('SELF');
    const managerRequired = requiredBaseTypes.has('MANAGER');
    const peerRequired = requiredBaseTypes.has('PEER');

    const allReviewsComplete =
      cycle.status === 'COMPLETED' &&
      (!selfRequired || hasSelfReview) &&
      (!managerRequired || assignedManagerReviewers === 0 || managerReviews.length > 0) &&
      (!peerRequired || assignedPeerReviewers === 0 || peerReviews.length > 0);

    return {
      personalScore: allReviewsComplete ? personalScore : null,
      allReviewsComplete,
      companyAverage: companyAverage ? Number(companyAverage.toFixed(2)) : null,
      scoreBreakdown: {
        self: breakdown.self ? Number(breakdown.self.toFixed(2)) : null,
        manager: breakdown.manager
          ? Number(breakdown.manager.toFixed(2))
          : null,
        peer: breakdown.peer ? Number(breakdown.peer.toFixed(2)) : null,
      },
      pendingTasks: {
        selfReview: !hasSelfReview,
        peerReviews: Math.max(0, peerAssignments - completedPeerReviews),
        managerReviews: Math.max(0, managerUpwardAssignments - completedManagerUpwardReviews),
      },
      taskCounts: {
        selfTotal: 1,
        peerTotal: peerAssignments,
        managerTotal: managerUpwardAssignments,
        selfCompleted: hasSelfReview ? 1 : 0,
        peerCompleted: completedPeerReviews,
        managerCompleted: completedManagerUpwardReviews,
      },
      reviewCounts: {
        self: selfReview ? 1 : 0,
        manager: managerReviews.length,
        peer: peerReviews.length,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Single-employee score calculation — used when a pre-loaded batch is unavailable.
   * For bulk use, prefer calculateAllEmployeeScores which batches the DB load.
   */
  private async calculateEmployeeScore(
    employeeId: string,
    cycleId: string,
    companyId: string,
  ): Promise<number | null> {
    const reviews = await this.prisma.review.findMany({
      where: { reviewCycleId: cycleId, employeeId, status: 'SUBMITTED' },
      select: {
        id: true,
        employeeId: true,
        reviewType: true,
        answers: {
          select: {
            rating: true,
            question: { select: { type: true } },
          },
        },
      },
    });

    return this.scoreFromReviews(reviews);
  }

  /**
   * Batch calculate scores for multiple employees.
   * Issues a single DB query regardless of employee count.
   */
  private async calculateAllEmployeeScores(
    cycleId: string,
    companyId: string,
    employees: any[],
  ): Promise<EmployeeScore[]> {
    if (employees.length === 0) return [];

    // Single batch query for all submitted reviews across all employees.
    // Use select (not include) to fetch only the fields scoreFromReviews needs:
    // answer.rating + answer.question.type — avoids loading all text/metadata fields.
    const allReviews = await this.prisma.review.findMany({
      where: { reviewCycleId: cycleId, status: 'SUBMITTED' },
      select: {
        id: true,
        employeeId: true,
        reviewType: true,
        answers: {
          select: {
            rating: true,
            question: { select: { type: true } },
          },
        },
      },
    });

    // Group by employeeId for O(1) lookup
    const reviewsByEmployee = new Map<string, any[]>();
    for (const review of allReviews) {
      const list = reviewsByEmployee.get(review.employeeId) ?? [];
      list.push(review);
      reviewsByEmployee.set(review.employeeId, list);
    }

    return employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      score: this.scoreFromReviews(reviewsByEmployee.get(emp.id) ?? []),
    }));
  }

  /** Pure in-memory score calculation from pre-loaded submitted reviews. No DB calls. */
  private scoreFromReviews(reviews: any[]): number | null {
    if (reviews.length === 0) return null;

    const selfReview = reviews.find((r) => r.reviewType === 'SELF');
    const managerReviews = reviews.filter((r) => r.reviewType === 'DOWNWARD' || r.reviewType === 'MANAGER');
    const peerReviews = reviews.filter((r) => r.reviewType === 'PEER');

    const scores: number[] = [];
    if (selfReview) {
      const avg = this.ratingAvgFromAnswers(selfReview.answers);
      if (avg !== null) scores.push(avg);
    }
    if (managerReviews.length > 0) {
      const avg = this.multiReviewRatingAvg(managerReviews);
      if (avg !== null) scores.push(avg);
    }
    if (peerReviews.length > 0) {
      const avg = this.multiReviewRatingAvg(peerReviews);
      if (avg !== null) scores.push(avg);
    }

    return scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : null;
  }

  private ratingAvgFromAnswers(answers: any[]): number | null {
    const ratings = answers
      .filter((a) => a.question.type === 'RATING' && a.rating !== null)
      .map((a: any) => a.rating as number);
    return ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
  }

  private multiReviewRatingAvg(reviews: any[]): number | null {
    const avgs = reviews
      .map((r) => this.ratingAvgFromAnswers(r.answers))
      .filter((a): a is number => a !== null);
    return avgs.length > 0
      ? avgs.reduce((sum, a) => sum + a, 0) / avgs.length
      : null;
  }
}
