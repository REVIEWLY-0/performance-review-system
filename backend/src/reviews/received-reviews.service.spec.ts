import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPLOYEE_ID = 'emp-1';
const MANAGER_ID  = 'mgr-1';
const PEER_ID_1   = 'peer-1';
const PEER_ID_2   = 'peer-2';
const PEER_ID_3   = 'peer-3';
const COMPANY_ID  = 'co-1';
const CYCLE_ID    = 'cycle-1';

const Q = { id: 'q-1', text: 'Communication', type: 'RATING', order: 1 };

function makeAnswer(rating: number | null, text: string | null = null) {
  return { questionId: Q.id, rating, textAnswer: text, question: Q };
}

function makeReview(overrides: {
  reviewType: string;
  reviewerId: string;
  reviewerManagerId?: string | null;
  answers?: ReturnType<typeof makeAnswer>[];
}) {
  return {
    id: `rev-${Math.random()}`,
    reviewCycleId: CYCLE_ID,
    employeeId: EMPLOYEE_ID,
    reviewerId: overrides.reviewerId,
    reviewType: overrides.reviewType,
    status: 'SUBMITTED',
    updatedAt: new Date(),
    reviewer: {
      id: overrides.reviewerId,
      name: `User ${overrides.reviewerId}`,
      email: `${overrides.reviewerId}@co.com`,
      managerId: overrides.reviewerManagerId ?? null,
    },
    answers: overrides.answers ?? [makeAnswer(4)],
  };
}

const COMPLETED_CYCLE = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'COMPLETED' };
const ACTIVE_CYCLE    = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'ACTIVE' };

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(
  cycle: typeof COMPLETED_CYCLE | typeof ACTIVE_CYCLE | null,
  reviews: any[],
): ReviewsService {
  const prisma = {
    reviewCycle: {
      findFirst: jest.fn().mockResolvedValue(cycle),
    },
    review: {
      findMany: jest.fn().mockResolvedValue(reviews),
    },
  } as unknown as PrismaService;
  return new ReviewsService(prisma);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewsService.getMyReceivedReviews — anonymity enforcement', () => {

  // ── Visibility gate ────────────────────────────────────────────────────────

  it('returns { locked: true } when cycle is ACTIVE (not COMPLETED)', async () => {
    const svc = makeService(ACTIVE_CYCLE, []);
    const result = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);
    expect(result).toMatchObject({ locked: true, cycleStatus: 'ACTIVE' });
  });

  it('throws NotFoundException when cycle is not found', async () => {
    const svc = makeService(null, []);
    await expect(
      svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── PEER reviews: anonymity ────────────────────────────────────────────────

  it('PEER reviews above threshold: returns entries WITHOUT reviewerId or reviewer.name', async () => {
    const peers = [
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_1, answers: [makeAnswer(4)] }),
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_2, answers: [makeAnswer(3)] }),
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_3, answers: [makeAnswer(5)] }),
    ];
    const svc = makeService(COMPLETED_CYCLE, peers);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.locked).toBe(false);
    expect(result.peer.withheld).toBe(false);
    expect(result.peer.count).toBe(3);
    for (const review of result.peer.reviews) {
      expect(review).not.toHaveProperty('reviewerId');
      expect(review).not.toHaveProperty('reviewer');
    }
  });

  it('PEER reviews with a single reviewer: always returned anonymous (no threshold suppression)', async () => {
    const peers = [
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_1, answers: [makeAnswer(4)] }),
    ];
    const svc = makeService(COMPLETED_CYCLE, peers);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.peer.withheld).toBe(false);
    expect(result.peer.count).toBe(1);
    expect(result.peer.reviews).toHaveLength(1);
    for (const review of result.peer.reviews) {
      expect(review).not.toHaveProperty('reviewerId');
      expect(review).not.toHaveProperty('reviewer');
    }
  });

  // ── MANAGER downward reviews: attributed ──────────────────────────────────

  it('MANAGER downward reviews include reviewer name (attributed)', async () => {
    const mgr = makeReview({
      reviewType: 'MANAGER',
      reviewerId: MANAGER_ID,
      reviewerManagerId: null, // not a subordinate of EMPLOYEE_ID
      answers: [makeAnswer(5)],
    });
    const svc = makeService(COMPLETED_CYCLE, [mgr]);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.manager).toHaveLength(1);
    expect(result.manager[0].reviewer.name).toBe(`User ${MANAGER_ID}`);
    expect(result.manager[0].reviewer.email).toBe(`${MANAGER_ID}@co.com`);
  });

  // ── Upward reviews: anonymous ─────────────────────────────────────────────

  it('upward MANAGER review (reviewer.managerId === employeeId) is treated anonymously', async () => {
    // Reviewer's manager IS the employee — so this is an upward review (subordinate→manager)
    const upward = makeReview({
      reviewType: 'MANAGER',
      reviewerId: 'sub-1',
      reviewerManagerId: EMPLOYEE_ID,  // reviewer reports to EMPLOYEE_ID → upward
      answers: [makeAnswer(3)],
    });
    const upward2 = makeReview({
      reviewType: 'MANAGER',
      reviewerId: 'sub-2',
      reviewerManagerId: EMPLOYEE_ID,
      answers: [makeAnswer(4)],
    });
    const upward3 = makeReview({
      reviewType: 'MANAGER',
      reviewerId: 'sub-3',
      reviewerManagerId: EMPLOYEE_ID,
      answers: [makeAnswer(5)],
    });
    const svc = makeService(COMPLETED_CYCLE, [upward, upward2, upward3]);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.upward.withheld).toBe(false);
    expect(result.upward.count).toBe(3);
    for (const review of result.upward.reviews) {
      expect(review).not.toHaveProperty('reviewerId');
      expect(review).not.toHaveProperty('reviewer');
    }
    // Attributed manager section should be empty
    expect(result.manager).toHaveLength(0);
  });

  it('upward review with a single reviewer: always returned anonymous (no threshold suppression)', async () => {
    const upward = makeReview({
      reviewType: 'MANAGER',
      reviewerId: 'sub-1',
      reviewerManagerId: EMPLOYEE_ID,
      answers: [makeAnswer(2)],
    });
    const svc = makeService(COMPLETED_CYCLE, [upward]);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.upward.withheld).toBe(false);
    expect(result.upward.count).toBe(1);
    expect(result.upward.reviews).toHaveLength(1);
    expect(result.upward.reviews[0]).not.toHaveProperty('reviewer');
    expect(result.upward.reviews[0]).not.toHaveProperty('reviewerId');
  });

  // ── SELF reviews: attributed ───────────────────────────────────────────────

  it('SELF review is included attributed with reviewer name', async () => {
    const self = makeReview({
      reviewType: 'SELF',
      reviewerId: EMPLOYEE_ID,
      reviewerManagerId: null,
      answers: [makeAnswer(4)],
    });
    const svc = makeService(COMPLETED_CYCLE, [self]);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.self).toHaveLength(1);
    expect(result.self[0].reviewer.name).toBe(`User ${EMPLOYEE_ID}`);
  });

  // ── Mixed reviews ──────────────────────────────────────────────────────────

  it('correctly routes mixed review types into the right sections', async () => {
    const reviews = [
      makeReview({ reviewType: 'SELF', reviewerId: EMPLOYEE_ID }),
      makeReview({ reviewType: 'MANAGER', reviewerId: MANAGER_ID, reviewerManagerId: null }),
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_1 }),
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_2 }),
      makeReview({ reviewType: 'PEER', reviewerId: PEER_ID_3 }),
      makeReview({ reviewType: 'MANAGER', reviewerId: 'sub-1', reviewerManagerId: EMPLOYEE_ID }),
      makeReview({ reviewType: 'MANAGER', reviewerId: 'sub-2', reviewerManagerId: EMPLOYEE_ID }),
      makeReview({ reviewType: 'MANAGER', reviewerId: 'sub-3', reviewerManagerId: EMPLOYEE_ID }),
    ];
    const svc = makeService(COMPLETED_CYCLE, reviews);

    const result: any = await svc.getMyReceivedReviews(EMPLOYEE_ID, COMPANY_ID, CYCLE_ID);

    expect(result.self).toHaveLength(1);
    expect(result.manager).toHaveLength(1);
    expect(result.peer.withheld).toBe(false);
    expect(result.peer.count).toBe(3);
    expect(result.upward.withheld).toBe(false);
    expect(result.upward.count).toBe(3);
  });
});
