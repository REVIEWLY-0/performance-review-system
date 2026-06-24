import { ScoringService } from './scoring.service';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DepartmentQuantScoresService } from '../department-quant-scores/department-quant-scores.service';
import { ScoreWeightsService } from '../score-weights/score-weights.service';

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
  // calculateScoreFromData is pure — no DB/dept-quant/weights calls needed.
  return new ScoringService(
    {} as PrismaService,
    {} as NotificationsService,
    {} as DepartmentQuantScoresService,
    {} as ScoreWeightsService,
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

  // ── Weighted formula (configured weights) ─────────────────────────────────

  const calcWeighted = (
    svc: ScoringService,
    reviews: any[],
    weights: { quantWeight: number; managerWeight: number; peerWeight: number; selfWeight: number; minPeerThreshold: number },
    quantScore: number | null = null,
  ) =>
    (svc as any).calculateScoreFromData(EMPLOYEE, CYCLE, reviews, QUESTIONS, weights, quantScore);

  it('applies configured weights (60/30/10) to qual sources', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('DOWNWARD', { 'q-1': 5, 'q-2': 5 }),   // managerAvg = 5
      makeReview('PEER',     { 'q-1': 3, 'q-2': 3 }),   // peerAvg = 3
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWeighted(service, reviews, weights);

    // qualScore = 4*0.10 + 5*0.60 + 3*0.30 = 0.4 + 3.0 + 0.9 = 4.30
    expect(result.overall_score).toBe(4.30);
    expect(result.breakdown.self).toBe(4.00);
    expect(result.breakdown.manager).toBe(5.00);
    expect(result.breakdown.peer).toBe(3.00);
  });

  it('re-normalises weights when manager is missing', () => {
    const reviews = [
      makeReview('SELF', { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('PEER', { 'q-1': 2, 'q-2': 2 }),   // peerAvg = 2
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWeighted(service, reviews, weights);

    // present weights: peer=30, self=10; total=40
    // effective: peer = 30/40 = 0.75, self = 10/40 = 0.25
    // qualScore = 4*0.25 + 2*0.75 = 1.0 + 1.5 = 2.50
    expect(result.overall_score).toBe(2.50);
    expect(result.breakdown.manager).toBeNull();
  });

  it('re-normalises weights when peer is missing', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('DOWNWARD', { 'q-1': 2, 'q-2': 2 }),   // managerAvg = 2
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWeighted(service, reviews, weights);

    // present weights: manager=60, self=10; total=70
    // effective: manager = 60/70 ≈ 0.857, self = 10/70 ≈ 0.143
    // qualScore = 4*(10/70) + 2*(60/70) = 40/70 + 120/70 = 160/70 ≈ 2.29
    expect(result.overall_score).toBe(2.29);
    expect(result.breakdown.peer).toBeNull();
  });

  it('blends quant + qual when both present (50/50 default split)', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('DOWNWARD', { 'q-1': 4, 'q-2': 4 }),   // managerAvg = 4
      makeReview('PEER',     { 'q-1': 4, 'q-2': 4 }),   // peerAvg = 4
    ];
    // All qual sources = 4, quant = 2, weights 50/50
    const weights = { quantWeight: 50, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };
    const quantScore = 2;

    const result = calcWeighted(service, reviews, weights, quantScore);

    // qualScore = 4*0.10 + 4*0.60 + 4*0.30 = 4.00
    // finalScore = (2 * 50 + 4 * 50) / 100 = (100 + 200) / 100 = 3.00
    expect(result.overall_score).toBe(3.00);
    expect(result.breakdown.quant).toBe(2.00);
  });

  it('uses qual-only (qualWeight=100%) when no quant score available', () => {
    const reviews = [makeReview('SELF', { 'q-1': 3, 'q-2': 3 })];  // selfAvg = 3
    const weights = { quantWeight: 50, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWeighted(service, reviews, weights, null);

    // No quant → qualWeight becomes 100%; qualScore = selfAvg = 3
    expect(result.overall_score).toBe(3.00);
    expect(result.breakdown.quant).toBeNull();
  });

  it('exposes quant score in breakdown', () => {
    const reviews = [makeReview('SELF', { 'q-1': 5, 'q-2': 5 })];
    const weights = { quantWeight: 50, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWeighted(service, reviews, weights, 3);

    expect(result.breakdown.quant).toBe(3.00);
  });

  // ── Manager-path overrides ─────────────────────────────────────────────────

  const calcWithOverrides = (
    svc: ScoringService,
    reviews: any[],
    weights: { quantWeight: number; managerWeight: number; peerWeight: number; selfWeight: number; minPeerThreshold: number },
    overrideManagerAvg: number | null | undefined,
    overridePeerAvg: number | null | undefined,
    quantScore: number | null = null,
  ) =>
    (svc as any).calculateScoreFromData(
      EMPLOYEE, CYCLE, reviews, QUESTIONS, weights, quantScore,
      overrideManagerAvg, overridePeerAvg,
    );

  it('uses overrideManagerAvg in place of DOWNWARD reviews when provided', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('DOWNWARD', { 'q-1': 1, 'q-2': 1 }),   // ignored when override present
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWithOverrides(service, reviews, weights, 5, undefined);

    // managerAvg = 5 (override), peerAvg from reviews = null (no PEER reviews)
    // present: self=4(10%), manager=5(60%) → total=70
    // qualScore = 4*(10/70) + 5*(60/70) = 40/70 + 300/70 = 340/70 ≈ 4.86
    expect(result.breakdown.manager).toBe(5.00);
    expect(result.overall_score).toBe(Number((340 / 70).toFixed(2)));
  });

  it('uses overridePeerAvg in place of PEER reviews when provided', () => {
    const reviews = [
      makeReview('SELF', { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('PEER', { 'q-1': 1, 'q-2': 1 }),   // ignored when override present
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWithOverrides(service, reviews, weights, undefined, 3);

    // peerAvg = 3 (override), managerAvg from reviews = null (no DOWNWARD reviews)
    // present: self=4(10%), peer=3(30%) → total=40
    // qualScore = 4*(10/40) + 3*(30/40) = 40/40 + 90/40 = 130/40 = 3.25
    expect(result.breakdown.peer).toBe(3.00);
    expect(result.overall_score).toBe(3.25);
  });

  it('uses both overrides together with correct weighted formula', () => {
    const reviews = [makeReview('SELF', { 'q-1': 4, 'q-2': 4 })];  // selfAvg = 4
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWithOverrides(service, reviews, weights, 5, 3);

    // qualScore = 4*0.10 + 5*0.60 + 3*0.30 = 0.4 + 3.0 + 0.9 = 4.30
    expect(result.breakdown.self).toBe(4.00);
    expect(result.breakdown.manager).toBe(5.00);
    expect(result.breakdown.peer).toBe(3.00);
    expect(result.overall_score).toBe(4.30);
  });

  it('re-normalises when overrideManagerAvg is null (CEO review missing)', () => {
    const reviews = [makeReview('SELF', { 'q-1': 4, 'q-2': 4 })];  // selfAvg = 4
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    // null override = CEO review absent → manager slot drops out
    const result = calcWithOverrides(service, reviews, weights, null, 3);

    // present: self=4(10%), peer=3(30%) → total=40
    // qualScore = 4*(10/40) + 3*(30/40) = 1.0 + 2.25 = 3.25
    expect(result.breakdown.manager).toBeNull();
    expect(result.breakdown.peer).toBe(3.00);
    expect(result.overall_score).toBe(3.25);
  });

  it('re-normalises when overridePeerAvg is null (no upward reviews)', () => {
    const reviews = [makeReview('SELF', { 'q-1': 4, 'q-2': 4 })];  // selfAvg = 4
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    const result = calcWithOverrides(service, reviews, weights, 5, null);

    // present: self=4(10%), manager=5(60%) → total=70
    // qualScore = 4*(10/70) + 5*(60/70) = 340/70 ≈ 4.86
    expect(result.breakdown.peer).toBeNull();
    expect(result.breakdown.manager).toBe(5.00);
    expect(result.overall_score).toBe(Number((340 / 70).toFixed(2)));
  });

  it('undefined overrides fall back to standard review-based classification', () => {
    const reviews = [
      makeReview('SELF',     { 'q-1': 4, 'q-2': 4 }),   // selfAvg = 4
      makeReview('DOWNWARD', { 'q-1': 5, 'q-2': 5 }),   // managerAvg = 5
      makeReview('PEER',     { 'q-1': 3, 'q-2': 3 }),   // peerAvg = 3
    ];
    const weights = { quantWeight: 0, managerWeight: 60, peerWeight: 30, selfWeight: 10, minPeerThreshold: 3 };

    // undefined = not a manager, use standard path
    const result = calcWithOverrides(service, reviews, weights, undefined, undefined);

    expect(result.overall_score).toBe(4.30);
  });
});
