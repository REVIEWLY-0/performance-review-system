import { fetchWithAuth } from './api';
import { cachedFetch } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================================================
// Types
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
}

export interface ReviewCounts {
  self_reviews: number;
  manager_reviews: number;
  peer_reviews: number;
}

export interface FinalScore {
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
  calculatedAt: string;
  scores: FinalScore[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Calculate final score for a specific employee
 */
export function calculateScore(
  cycleId: string,
  employeeId: string,
): Promise<FinalScore> {
  return cachedFetch(
    `score:${cycleId}:${employeeId}`,
    () => fetchWithAuth(`${API_URL}/scoring/calculate/${cycleId}/${employeeId}`, { method: 'POST' }),
    30_000,
  );
}

/**
 * Calculate scores for all employees in a cycle
 */
export async function calculateAllScores(
  cycleId: string,
): Promise<AllScoresResponse> {
  return fetchWithAuth(`${API_URL}/scoring/calculate-all/${cycleId}`, {
    method: 'POST',
  });
}
