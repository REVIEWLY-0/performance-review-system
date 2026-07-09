import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MANAGER_ID   = 'mgr-1';
const OTHER_MGR_ID = 'mgr-2';
const EMPLOYEE_ID  = 'emp-1';
const COMPANY_ID   = 'co-1';
const CYCLE_ID     = 'cycle-1';

const Q = { id: 'q-1', text: 'Collaboration', type: 'RATING', order: 1 };

function makeAnswer(rating: number | null, text: string | null = null) {
  return { questionId: Q.id, rating, textAnswer: text, question: Q };
}

function makePeerReview(answers = [makeAnswer(4)]) {
  return {
    reviewType: 'PEER',
    status: 'SUBMITTED',
    answers,
  };
}

const ACTIVE_CYCLE    = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'ACTIVE' };
const COMPLETED_CYCLE = { id: CYCLE_ID, companyId: COMPANY_ID, status: 'COMPLETED' };

const VALID_ASSIGNMENT = {
  id: 'assign-1',
  reviewCycleId: CYCLE_ID,
  employeeId: EMPLOYEE_ID,
  reviewerId: MANAGER_ID,
  reviewerType: 'MANAGER',
};

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(opts: {
  cycle: typeof ACTIVE_CYCLE | typeof COMPLETED_CYCLE | null;
  assignment: typeof VALID_ASSIGNMENT | null;
  peerReviews: ReturnType<typeof makePeerReview>[];
}) {
  const reviewFindMany = jest.fn().mockResolvedValue(opts.peerReviews);
  const assignmentFindFirst = jest.fn().mockResolvedValue(opts.assignment);
  const prisma = {
    reviewCycle: {
      // Mirror Prisma's own filtering: findFirst only "finds" the fixture cycle
      // when its status matches the status the query actually filtered on.
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (!opts.cycle) return Promise.resolve(null);
        if (args?.where?.status && args.where.status !== opts.cycle.status) {
          return Promise.resolve(null);
        }
        return Promise.resolve(opts.cycle);
      }),
    },
    reviewerAssignment: {
      findFirst: assignmentFindFirst,
    },
    review: {
      findMany: reviewFindMany,
    },
  } as unknown as PrismaService;
  return { svc: new ReviewsService(prisma), reviewFindMany, assignmentFindFirst };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewsService.getDownwardReviewContext', () => {
  it('throws NotFoundException when the cycle is not ACTIVE', async () => {
    const { svc } = makeService({
      cycle: COMPLETED_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [makePeerReview()],
    });

    await expect(
      svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the caller has no MANAGER assignment for this employee', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: null, // caller is not the assigned manager reviewer
      peerReviews: [makePeerReview()],
    });

    await expect(
      svc.getDownwardReviewContext(OTHER_MGR_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('scopes the assignment lookup to reviewCycleId/employeeId/reviewerId/reviewerType=MANAGER', async () => {
    const { svc, assignmentFindFirst } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [],
    });

    await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    expect(assignmentFindFirst).toHaveBeenCalledWith({
      where: {
        reviewCycleId: CYCLE_ID,
        employeeId: EMPLOYEE_ID,
        reviewerId: MANAGER_ID,
        reviewerType: 'MANAGER',
        reviewCycle: { companyId: COMPANY_ID },
      },
    });
  });

  it('queries only SUBMITTED PEER reviews about this employee, in this cycle/company', async () => {
    const { svc, reviewFindMany } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [],
    });

    await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    const call = reviewFindMany.mock.calls[0][0];
    expect(call.where).toEqual({
      reviewCycleId: CYCLE_ID,
      employeeId: EMPLOYEE_ID,
      reviewType: 'PEER',
      status: 'SUBMITTED',
      reviewCycle: { companyId: COMPANY_ID },
    });
  });

  it('never selects reviewerId or reviewer for the peer review query (anonymity)', async () => {
    const { svc, reviewFindMany } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [],
    });

    await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    const call = reviewFindMany.mock.calls[0][0];
    expect(call.select).not.toHaveProperty('reviewerId');
    expect(call.select).not.toHaveProperty('reviewer');
  });

  it('returns anonymous entries with no reviewer field, no threshold/withheld state', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [makePeerReview([makeAnswer(4)])],
    });

    const result: any = await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    expect(result.peer.count).toBe(1);
    expect(result.peer.reviews).toHaveLength(1);
    expect(result.peer.reviews[0]).not.toHaveProperty('reviewer');
    expect(result.peer.reviews[0]).not.toHaveProperty('reviewerId');
    expect(result.peer.reviews[0]).not.toHaveProperty('withheld');
    expect(result.peer.reviews[0]).not.toHaveProperty('threshold');
  });

  it('returns a single submitted peer review unmodified (no minPeerThreshold suppression)', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [makePeerReview([makeAnswer(2)])],
    });

    const result: any = await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    expect(result.peer.count).toBe(1);
    expect(result.peer.reviews).toHaveLength(1);
  });

  it('returns count 0 and empty reviews when no peer reviews are submitted yet', async () => {
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [],
    });

    const result: any = await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    expect(result.peer.count).toBe(0);
    expect(result.peer.reviews).toEqual([]);
  });

  it('serializes answers sorted by question order with questionText/questionType/rating/textAnswer', async () => {
    const q2 = { id: 'q-2', text: 'Reliability', type: 'RATING', order: 0 };
    const { svc } = makeService({
      cycle: ACTIVE_CYCLE,
      assignment: VALID_ASSIGNMENT,
      peerReviews: [
        makePeerReview([
          { questionId: Q.id, rating: 4, textAnswer: null, question: Q },
          { questionId: q2.id, rating: 5, textAnswer: 'Great teammate', question: q2 },
        ]),
      ],
    });

    const result: any = await svc.getDownwardReviewContext(MANAGER_ID, COMPANY_ID, CYCLE_ID, EMPLOYEE_ID);

    const answers = result.peer.reviews[0].answers;
    expect(answers[0]).toMatchObject({ questionId: q2.id, questionText: 'Reliability', rating: 5, textAnswer: 'Great teammate' });
    expect(answers[1]).toMatchObject({ questionId: Q.id, questionText: 'Collaboration', rating: 4, textAnswer: null });
  });
});
