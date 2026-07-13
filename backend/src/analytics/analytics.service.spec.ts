import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPLOYEE_ID = 'daniel-1';
const COMPANY_ID  = 'co-1';
const CYCLE_ID    = 'cycle-1';

const ACTIVE_CYCLE = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'ACTIVE' };

// ─── Service factory ──────────────────────────────────────────────────────────
//
// getEmployeeAnalytics derives its upward "Manager Review — X of Y" counter from
// two independent Prisma count() calls (assignments = Y, submitted reviews = X),
// dispatched here by inspecting each call's `where` clause so a single mock can
// stand in for the several count()/findMany() calls the method fires in parallel.

function makeService(opts: {
  managerUpwardAssignments: number; // Y — count of ReviewerAssignment{reviewerType:MANAGER, employee.role:MANAGER}
  completedManagerUpwardReviews: number; // X — count of submitted Review{reviewType:MANAGER}
}) {
  const assignmentCount = jest.fn().mockImplementation((args: any) => {
    const w = args.where;
    if (w.reviewerId === EMPLOYEE_ID && w.reviewerType === 'MANAGER' && w.employee) {
      return Promise.resolve(opts.managerUpwardAssignments);
    }
    return Promise.resolve(0); // peer/incoming counts — not under test here
  });

  const reviewCount = jest.fn().mockImplementation((args: any) => {
    const w = args.where;
    if (w.reviewerId === EMPLOYEE_ID && w.reviewType === 'MANAGER' && w.status === 'SUBMITTED') {
      return Promise.resolve(opts.completedManagerUpwardReviews);
    }
    return Promise.resolve(0); // peer completed count — not under test here
  });

  const prisma = {
    reviewCycle: { findFirst: jest.fn().mockResolvedValue(ACTIVE_CYCLE) },
    review: {
      findMany: jest.fn().mockResolvedValue([]), // no personal reviews needed for this test
      count: reviewCount,
    },
    reviewerAssignment: { count: assignmentCount },
    // Empty company roster short-circuits calculateAllEmployeeScores before it
    // issues its own review.findMany, keeping this test focused on the counter.
    user: { findMany: jest.fn().mockResolvedValue([]) },
    reviewTypeConfig: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  return { svc: new AnalyticsService(prisma), assignmentCount, reviewCount };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnalyticsService.getEmployeeAnalytics — upward manager-review counter', () => {
  it('is not hardcoded to 1: reflects N assignments and however many of them are submitted', async () => {
    const { svc } = makeService({ managerUpwardAssignments: 3, completedManagerUpwardReviews: 1 });

    const result = await svc.getEmployeeAnalytics(EMPLOYEE_ID, CYCLE_ID, COMPANY_ID);

    expect(result.taskCounts.managerTotal).toBe(3);
    expect(result.taskCounts.managerCompleted).toBe(1);
    expect(result.pendingTasks.managerReviews).toBe(2);
  });

  it('shows "0 of N" for multiple upward assignments with none submitted yet', async () => {
    const { svc } = makeService({ managerUpwardAssignments: 2, completedManagerUpwardReviews: 0 });

    const result = await svc.getEmployeeAnalytics(EMPLOYEE_ID, CYCLE_ID, COMPANY_ID);

    expect(result.taskCounts.managerTotal).toBe(2);
    expect(result.taskCounts.managerCompleted).toBe(0);
    expect(result.pendingTasks.managerReviews).toBe(2);
  });

  it('still reports "0 of 1" correctly for the single-target case (no regression)', async () => {
    const { svc } = makeService({ managerUpwardAssignments: 1, completedManagerUpwardReviews: 0 });

    const result = await svc.getEmployeeAnalytics(EMPLOYEE_ID, CYCLE_ID, COMPANY_ID);

    expect(result.taskCounts.managerTotal).toBe(1);
    expect(result.taskCounts.managerCompleted).toBe(0);
  });

  it('reports "N of N" once every upward assignment has been submitted', async () => {
    const { svc } = makeService({ managerUpwardAssignments: 3, completedManagerUpwardReviews: 3 });

    const result = await svc.getEmployeeAnalytics(EMPLOYEE_ID, CYCLE_ID, COMPANY_ID);

    expect(result.taskCounts.managerTotal).toBe(3);
    expect(result.taskCounts.managerCompleted).toBe(3);
    expect(result.pendingTasks.managerReviews).toBe(0);
  });

  it('scopes the assignment count to reviewerType MANAGER and employee.role MANAGER (assignment-based, not org-chart)', async () => {
    const { svc, assignmentCount } = makeService({ managerUpwardAssignments: 1, completedManagerUpwardReviews: 0 });

    await svc.getEmployeeAnalytics(EMPLOYEE_ID, CYCLE_ID, COMPANY_ID);

    const upwardCall = assignmentCount.mock.calls.find(
      (c: any[]) => c[0].where.reviewerId === EMPLOYEE_ID && c[0].where.employee,
    );
    expect(upwardCall[0].where).toEqual({
      reviewCycleId: CYCLE_ID,
      reviewerId: EMPLOYEE_ID,
      reviewerType: 'MANAGER',
      employee: { role: 'MANAGER' },
    });
  });
});
