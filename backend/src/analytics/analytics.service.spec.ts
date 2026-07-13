import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPLOYEE_ID = 'daniel-1';
const MANAGER_ID  = 'tobi-1';
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

// ─── getManagerAnalytics — Team Size (Bug B) ───────────────────────────────────
//
// Team Size must come from reviewer_assignments (the manager's downward-assigned
// employees in this cycle), not from the org-chart User.managerId relationship.
// The mock Prisma object below deliberately does NOT implement `user.count` —
// if a regression reintroduces a call to it, these tests fail with a "not a
// function" error rather than silently passing.

function makeManagerAnalyticsService(assignedEmployees: { id: string; name: string; email: string }[]) {
  const assignments = assignedEmployees.map((e) => ({
    id: `assign-${e.id}`,
    reviewCycleId: CYCLE_ID,
    employeeId: e.id,
    reviewerId: MANAGER_ID,
    reviewerType: 'MANAGER',
    employee: e,
  }));

  const assignmentFindMany = jest.fn().mockResolvedValue(assignments);

  const prisma = {
    reviewCycle: { findFirst: jest.fn().mockResolvedValue(ACTIVE_CYCLE) },
    reviewerAssignment: { findMany: assignmentFindMany },
    review: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) }, // no user.count on this mock — see note above
  } as unknown as PrismaService;

  return { svc: new AnalyticsService(prisma), assignmentFindMany };
}

describe('AnalyticsService.getManagerAnalytics — Team Size (assignment-based, not org-chart)', () => {
  it("reflects Tobi's case: 3 downward-assigned employees → Team Size 3", async () => {
    const { svc } = makeManagerAnalyticsService([
      { id: 'comfort-1', name: 'Comfort Edet', email: 'comfort@co.com' },
      { id: 'daniel-1', name: 'Daniel Igwe', email: 'daniel@co.com' },
      { id: 'irene-1', name: 'Irene Jones', email: 'irene@co.com' },
    ]);

    const result = await svc.getManagerAnalytics(MANAGER_ID, CYCLE_ID, COMPANY_ID);

    expect(result.teamSize).toBe(3);
    expect(result.teamMembers).toHaveLength(3);
  });

  it('shows Team Size N for an arbitrary number of assigned downward employees', async () => {
    const { svc } = makeManagerAnalyticsService([
      { id: 'e1', name: 'E1', email: 'e1@co.com' },
      { id: 'e2', name: 'E2', email: 'e2@co.com' },
      { id: 'e3', name: 'E3', email: 'e3@co.com' },
      { id: 'e4', name: 'E4', email: 'e4@co.com' },
      { id: 'e5', name: 'E5', email: 'e5@co.com' },
    ]);

    const result = await svc.getManagerAnalytics(MANAGER_ID, CYCLE_ID, COMPANY_ID);

    expect(result.teamSize).toBe(5);
  });

  it('shows Team Size 0 when the manager has no downward assignments this cycle', async () => {
    const { svc } = makeManagerAnalyticsService([]);

    const result = await svc.getManagerAnalytics(MANAGER_ID, CYCLE_ID, COMPANY_ID);

    expect(result.teamSize).toBe(0);
    expect(result.teamMembers).toEqual([]);
  });

  it('derives Team Size from the same assignment query used to build teamMembers, scoped to reviewerType MANAGER and employee.role EMPLOYEE', async () => {
    const { svc, assignmentFindMany } = makeManagerAnalyticsService([
      { id: 'comfort-1', name: 'Comfort Edet', email: 'comfort@co.com' },
    ]);

    await svc.getManagerAnalytics(MANAGER_ID, CYCLE_ID, COMPANY_ID);

    expect(assignmentFindMany).toHaveBeenCalledTimes(1);
    const call = assignmentFindMany.mock.calls[0][0];
    expect(call.where).toEqual({
      reviewCycleId: CYCLE_ID,
      reviewerId: MANAGER_ID,
      reviewerType: 'MANAGER',
      employee: { role: 'EMPLOYEE' },
    });
  });
});
