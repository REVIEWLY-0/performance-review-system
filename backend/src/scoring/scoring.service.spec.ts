import { ScoringService } from './scoring.service';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const EMPLOYEE = { id: 'emp-1', name: 'Alice' };
const CYCLE    = { id: 'cycle-1', name: 'Q1 2026' };

const QUESTIONS = [
  { id: 'q-1', text: 'Communication',  reviewType: 'SELF', type: 'RATING', order: 1 },
  { id: 'q-2', text: 'Collaboration',  reviewType: 'SELF', type: 'RATING', order: 2 },
];

/** Build a review with answers for the given question ratings map */
function makeReview(type: string, ratings: Record<string, number>) {
  return {
    reviewType: type,
    answers: Object.entries(ratings).map(([questionId, rating]) => ({
      questionId,
      rating,
    })),
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(): ScoringService {
  // calculateScoreFromData is pure — no DB/notification calls needed.
  return new ScoringService(
    {} as PrismaService,
    {} as NotificationsService,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScoringService — calculateScoreFromData', () => {
  let service: ScoringService;

  beforeEach(() => {
    service = makeService();
  });

  // Helper to call the private method
  const calc = (service: ScoringService, reviews: any[], questions = QUESTIONS) =>
    (service as any).calculateScoreFromData(EMPLOYEE, CYCLE, reviews, questions);

  // ── Formula: all three sources ─────────────────────────────────────────────

  it('computes (self + managerAvg + peerAvg) / 3 when all review types present', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // self avg = 4.00
      makeReview('DOWNWARD', { 'q-1': 5, 'q-2': 3 }),   // manager avg = 4.00
      makeReview('PEER',     { 'q-1': 3, 'q-2': 3 }),   // peer avg = 3.00
    ];

    const result = calc(service, reviews);

    expect(result.breakdown.self).toBe(4.00);
    expect(result.breakdown.manager).toBe(4.00);
    expect(result.breakdown.peer).toBe(3.00);
    // overall = (4 + 4 + 3) / 3 = 3.67
    expect(result.overall_score).toBe(3.67);
    expect(result.warnings).toHaveLength(0);
  });

  it('averages multiple manager reviews correctly', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),
      makeReview('DOWNWARD', { 'q-1': 5, 'q-2': 5 }),   // manager 1: avg 5
      makeReview('DOWNWARD', { 'q-1': 3, 'q-2': 3 }),   // manager 2: avg 3
    ];

    const result = calc(service, reviews);

    // manager overall avg = (5 + 3) / 2 = 4.00 per question → 4.00 overall
    expect(result.breakdown.manager).toBe(4.00);
    expect(result.review_counts.manager_reviews).toBe(2);
  });

  it('averages multiple peer reviews correctly', () => {
    const reviews = [
      makeReview('SELF', { 'q-1': 4, 'q-2': 4 }),
      makeReview('PEER', { 'q-1': 2, 'q-2': 2 }),   // peer 1: avg 2
      makeReview('PEER', { 'q-1': 4, 'q-2': 4 }),   // peer 2: avg 4
    ];

    const result = calc(service, reviews);

    // peer avg = (2 + 4) / 2 = 3.00
    expect(result.breakdown.peer).toBe(3.00);
    expect(result.review_counts.peer_reviews).toBe(2);
  });

  // ── Fallback: two sources ──────────────────────────────────────────────────

  it('falls back to (self + peer) / 2 with warning when manager missing', () => {
    const reviews = [
      makeReview('SELF', { 'q-1': 4, 'q-2': 4 }),   // self = 4.00
      makeReview('PEER', { 'q-1': 2, 'q-2': 2 }),   // peer = 2.00
    ];

    const result = calc(service, reviews);

    expect(result.breakdown.manager).toBeNull();
    expect(result.overall_score).toBe(3.00);   // (4 + 2) / 2
    expect(result.warnings.some((w: string) => /manager/i.test(w))).toBe(true);
  });

  it('falls back to (self + manager) / 2 with warning when peers missing', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // self = 4.00
      makeReview('DOWNWARD', { 'q-1': 2, 'q-2': 2 }),   // manager = 2.00
    ];

    const result = calc(service, reviews);

    expect(result.breakdown.peer).toBeNull();
    expect(result.overall_score).toBe(3.00);   // (4 + 2) / 2
    expect(result.warnings.some((w: string) => /peer/i.test(w))).toBe(true);
  });

  // ── Fallback: one source ───────────────────────────────────────────────────

  it('returns self score only with warning when only self review exists', () => {
    const reviews = [makeReview('SELF', { 'q-1': 3, 'q-2': 5 })];  // self avg = 4.00

    const result = calc(service, reviews);

    expect(result.overall_score).toBe(4.00);
    expect(result.breakdown.manager).toBeNull();
    expect(result.breakdown.peer).toBeNull();
    expect(result.warnings.some((w: string) => /only self/i.test(w))).toBe(true);
  });

  // ── No data ────────────────────────────────────────────────────────────────

  it('returns null overall score with warning when no reviews submitted', () => {
    const result = calc(service, []);

    expect(result.overall_score).toBeNull();
    expect(result.breakdown.self).toBeNull();
    expect(result.breakdown.manager).toBeNull();
    expect(result.breakdown.peer).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns null overall score when no rating questions are configured', () => {
    const reviews = [makeReview('SELF', {})];
    const result = calc(service, reviews, []); // no questions

    expect(result.overall_score).toBeNull();
  });

  // ── Review counts ──────────────────────────────────────────────────────────

  it('populates review_counts correctly', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),
      makeReview('DOWNWARD', { 'q-1': 3, 'q-2': 3 }),
      makeReview('PEER',     { 'q-1': 5, 'q-2': 5 }),
      makeReview('PEER',     { 'q-1': 4, 'q-2': 4 }),
    ];

    const result = calc(service, reviews);

    expect(result.review_counts.self_reviews).toBe(1);
    expect(result.review_counts.manager_reviews).toBe(1);
    expect(result.review_counts.peer_reviews).toBe(2);
  });

  // ── Metadata ───────────────────────────────────────────────────────────────

  it('returns correct employeeId, employeeName, cycleId, cycleName', () => {
    const result = calc(service, []);

    expect(result.employeeId).toBe(EMPLOYEE.id);
    expect(result.employeeName).toBe(EMPLOYEE.name);
    expect(result.cycleId).toBe(CYCLE.id);
    expect(result.cycleName).toBe(CYCLE.name);
  });

  // ── Rounding ───────────────────────────────────────────────────────────────

  it('rounds all scores to 2 decimal places', () => {
    // 1 + 2 + 3 = 6 / 3 = 2.00 (clean), but per-question avgs of 1/3 are recurring
    const reviews = [
      makeReview('SELF',     { 'q-1': 1 }),
      makeReview('DOWNWARD', { 'q-1': 2 }),
      makeReview('PEER',     { 'q-1': 2 }),
    ];
    const result = calc(service, reviews, [QUESTIONS[0]]);

    // Each score should have at most 2 decimal places
    const asString = String(result.overall_score ?? '');
    const decimals = asString.includes('.') ? asString.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});
