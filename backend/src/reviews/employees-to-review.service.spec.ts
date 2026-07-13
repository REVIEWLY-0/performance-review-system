import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DANIEL_ID   = 'daniel-1';
const TOBI_ID     = 'tobi-1';
const CEO_ID      = 'ceo-1';
const COMPANY_ID  = 'co-1';
const CYCLE_ID    = 'cycle-1';

const ACTIVE_CYCLE = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'ACTIVE' };

function makeAssignment(overrides: {
  employeeId: string;
  employeeName: string;
  employeeRole: 'MANAGER' | 'EMPLOYEE';
}) {
  return {
    id: `assign-${overrides.employeeId}`,
    reviewCycleId: CYCLE_ID,
    employeeId: overrides.employeeId,
    reviewerId: DANIEL_ID,
    reviewerType: 'MANAGER',
    employee: {
      id: overrides.employeeId,
      name: overrides.employeeName,
      email: `${overrides.employeeId}@co.com`,
      department: null,
    },
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(opts: {
  cycle: typeof ACTIVE_CYCLE | null;
  assignments: ReturnType<typeof makeAssignment>[];
  reviews: { employeeId: string; status: string }[];
}) {
  // The role filter itself is a Prisma/DB-level concern (asserted separately on the
  // `where` clause below); the mock always returns the fixture rows as-is.
  const assignmentFindMany = jest.fn().mockResolvedValue(opts.assignments);
  const reviewFindMany = jest.fn().mockResolvedValue(opts.reviews);

  const prisma = {
    reviewCycle: { findFirst: jest.fn().mockResolvedValue(opts.cycle) },
    reviewerAssignment: { findMany: assignmentFindMany },
    review: { findMany: reviewFindMany },
  } as unknown as PrismaService;

  return { svc: new ReviewsService(prisma), assignmentFindMany, reviewFindMany };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewsService.getEmployeesToReview — upward listing (assignment-based)', () => {
  it('throws NotFoundException when cycle is not ACTIVE', async () => {
    const { svc } = makeService({ cycle: null, assignments: [], reviews: [] });
    await expect(
      svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('does NOT depend on User.managerId — no user lookup is performed before querying assignments', async () => {
    // Regression guard for the managerId-gate bug: previously this method first read
    // currentUser.managerId and returned [] immediately if it was null. The fixed
    // implementation must go straight to ReviewerAssignment without any such lookup.
    const { svc, assignmentFindMany } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [makeAssignment({ employeeId: TOBI_ID, employeeName: 'Oluwatobi Bankole', employeeRole: 'MANAGER' })],
      reviews: [],
    });

    const result = await svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID);

    expect(assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reviewCycleId: CYCLE_ID,
          reviewerId: DANIEL_ID,
          reviewerType: 'MANAGER',
          employee: { role: 'MANAGER' },
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: TOBI_ID, name: 'Oluwatobi Bankole', reviewStatus: 'NOT_STARTED' });
  });

  it('surfaces the backfilled NOT_STARTED review row for the reported Daniel → Tobi case', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [makeAssignment({ employeeId: TOBI_ID, employeeName: 'Oluwatobi Bankole', employeeRole: 'MANAGER' })],
      reviews: [{ employeeId: TOBI_ID, status: 'NOT_STARTED' }],
    });

    const result = await svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID);

    expect(result).toEqual([
      expect.objectContaining({ id: TOBI_ID, name: 'Oluwatobi Bankole', reviewStatus: 'NOT_STARTED' }),
    ]);
  });

  it('supports multiple upward targets in the same cycle', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [
        makeAssignment({ employeeId: TOBI_ID, employeeName: 'Oluwatobi Bankole', employeeRole: 'MANAGER' }),
        makeAssignment({ employeeId: CEO_ID, employeeName: 'Company CEO', employeeRole: 'MANAGER' }),
      ],
      reviews: [{ employeeId: TOBI_ID, status: 'DRAFT' }],
    });

    const result = await svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === TOBI_ID)).toMatchObject({ reviewStatus: 'DRAFT' });
    expect(result.find((r) => r.id === CEO_ID)).toMatchObject({ reviewStatus: 'NOT_STARTED' });
  });

  it('reflects a SUBMITTED status once the upward review is completed', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [makeAssignment({ employeeId: TOBI_ID, employeeName: 'Oluwatobi Bankole', employeeRole: 'MANAGER' })],
      reviews: [{ employeeId: TOBI_ID, status: 'SUBMITTED' }],
    });

    const result = await svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID);

    expect(result[0].reviewStatus).toBe('SUBMITTED');
  });

  it('queries assignments scoped to reviewerType MANAGER and employee.role MANAGER (excludes a caller\'s own downward reports)', async () => {
    const { svc, assignmentFindMany } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [],
      reviews: [],
    });

    await svc.getEmployeesToReview(DANIEL_ID, COMPANY_ID, CYCLE_ID);

    const call = assignmentFindMany.mock.calls[0][0];
    expect(call.where.reviewerType).toBe('MANAGER');
    expect(call.where.employee).toEqual({ role: 'MANAGER' });
  });
});
