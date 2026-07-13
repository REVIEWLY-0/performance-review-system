import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOBI_ID     = 'tobi-1';
const COMFORT_ID  = 'comfort-1';
const DANIEL_ID   = 'daniel-1';
const IRENE_ID    = 'irene-1';
const COMPANY_ID  = 'co-1';
const CYCLE_ID    = 'cycle-1';

const ACTIVE_CYCLE = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'ACTIVE' };

function makeAssignment(employeeId: string, employeeName: string) {
  return {
    id: `assign-${employeeId}`,
    reviewCycleId: CYCLE_ID,
    employeeId,
    reviewerId: TOBI_ID,
    reviewerType: 'MANAGER',
    employee: { id: employeeId, name: employeeName, email: `${employeeId}@co.com`, department: null },
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(opts: {
  cycle: typeof ACTIVE_CYCLE | null;
  currentManagerManagerId?: string | null; // Tobi's own org-chart manager (usually null in these tests)
  assignments: ReturnType<typeof makeAssignment>[];
  reviews: { employeeId: string; status: string; reviewType: string }[];
}) {
  const userFindFirst = jest.fn().mockResolvedValue({ managerId: opts.currentManagerManagerId ?? null });
  const assignmentFindMany = jest.fn().mockResolvedValue(opts.assignments);

  // Only rows matching the actual `where.reviewType` filter are returned — mirrors
  // Postgres filtering, which is the crux of what this fix depends on: the query
  // must ask for reviewType: 'DOWNWARD' only, not {in: ['DOWNWARD','MANAGER']}.
  const reviewFindMany = jest.fn().mockImplementation((args: any) => {
    const rt = args?.where?.reviewType;
    const rows = opts.reviews.filter((r) => (typeof rt === 'string' ? r.reviewType === rt : true));
    return Promise.resolve(rows);
  });

  const prisma = {
    reviewCycle: { findFirst: jest.fn().mockResolvedValue(opts.cycle) },
    user: { findFirst: userFindFirst },
    reviewerAssignment: { findMany: assignmentFindMany },
    review: { findMany: reviewFindMany },
  } as unknown as PrismaService;

  return { svc: new ReviewsService(prisma), assignmentFindMany, reviewFindMany };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewsService.getEmployeesToReviewDownward — status must reflect reviews.status (Bug A)', () => {
  it('throws NotFoundException when cycle is not ACTIVE', async () => {
    const { svc } = makeService({ cycle: null, assignments: [], reviews: [] });
    await expect(
      svc.getEmployeesToReviewDownward(TOBI_ID, COMPANY_ID, CYCLE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it("reproduces Tobi's case: 3 SUBMITTED downward reviews all show SUBMITTED (3/3), even with a stale MANAGER-type row present", async () => {
    // Comfort and Daniel each have BOTH their real, submitted DOWNWARD review AND a
    // stale, unrelated NOT_STARTED MANAGER-type row for the same (reviewerId, employeeId)
    // pair — reproducing the exact collision that caused the pre-fix Map to silently
    // pick the wrong row for some employees depending on array order.
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [
        makeAssignment(COMFORT_ID, 'Comfort Edet'),
        makeAssignment(DANIEL_ID, 'Daniel Igwe'),
        makeAssignment(IRENE_ID, 'Irene Jones'),
      ],
      reviews: [
        // Stale MANAGER-type rows ordered FIRST — this is exactly the array order
        // that broke the old `new Map(existingReviews.map(...))` last-write-wins logic.
        { employeeId: COMFORT_ID, status: 'NOT_STARTED', reviewType: 'MANAGER' },
        { employeeId: DANIEL_ID, status: 'NOT_STARTED', reviewType: 'MANAGER' },
        // Real downward reviews, all submitted
        { employeeId: COMFORT_ID, status: 'SUBMITTED', reviewType: 'DOWNWARD' },
        { employeeId: DANIEL_ID, status: 'SUBMITTED', reviewType: 'DOWNWARD' },
        { employeeId: IRENE_ID, status: 'SUBMITTED', reviewType: 'DOWNWARD' },
      ],
    });

    const result = await svc.getEmployeesToReviewDownward(TOBI_ID, COMPANY_ID, CYCLE_ID);

    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.reviewStatus).toBe('SUBMITTED');
    }
    // This is exactly what drives the frontend's "X/Y complete" counter
    // (stats.submitted = employees.filter(e => e.reviewStatus === 'SUBMITTED').length).
    const submittedCount = result.filter((r) => r.reviewStatus === 'SUBMITTED').length;
    expect(submittedCount).toBe(3);
    expect(result.length).toBe(3); // 3/3
  });

  it('queries only reviewType: DOWNWARD for status — never MANAGER', async () => {
    const { svc, reviewFindMany } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [makeAssignment(COMFORT_ID, 'Comfort Edet')],
      reviews: [],
    });

    await svc.getEmployeesToReviewDownward(TOBI_ID, COMPANY_ID, CYCLE_ID);

    const call = reviewFindMany.mock.calls[0][0];
    expect(call.where.reviewType).toBe('DOWNWARD');
  });

  it('still reports NOT_STARTED / DRAFT correctly when the real downward review has not been submitted', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignments: [makeAssignment(COMFORT_ID, 'Comfort Edet'), makeAssignment(DANIEL_ID, 'Daniel Igwe')],
      reviews: [
        { employeeId: COMFORT_ID, status: 'DRAFT', reviewType: 'DOWNWARD' },
        // Daniel has no DOWNWARD row at all yet
      ],
    });

    const result = await svc.getEmployeesToReviewDownward(TOBI_ID, COMPANY_ID, CYCLE_ID);

    expect(result.find((r) => r.id === COMFORT_ID)?.reviewStatus).toBe('DRAFT');
    expect(result.find((r) => r.id === DANIEL_ID)?.reviewStatus).toBe('NOT_STARTED');
  });

  it('returns an empty list when the manager has no downward assignments', async () => {
    const { svc } = makeService({ cycle: ACTIVE_CYCLE, assignments: [], reviews: [] });
    const result = await svc.getEmployeesToReviewDownward(TOBI_ID, COMPANY_ID, CYCLE_ID);
    expect(result).toEqual([]);
  });
});
