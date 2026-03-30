import { fetchWithAuth } from './api';
import { cachedFetch, invalidateCache } from './cache';

/** Call after any review submission to force fresh data on list pages */
export function invalidateReviewCaches() {
  invalidateCache('reviews:');
  invalidateCache('analytics:');
  invalidateCache('score:');
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================================================
// Types
// ============================================================================

export interface Answer {
  questionId: string;
  rating?: number | null;
  textAnswer?: string | null;
}

export interface TaskDefinition {
  id: string;
  label: string;
  description?: string;
  required: boolean;
}

export interface QuestionWithAnswer {
  id: string;
  reviewType: string;
  type: 'RATING' | 'TEXT' | 'TASK_LIST';
  text: string;
  maxChars: number | null;
  tasks?: TaskDefinition[] | null;
  order: number;
  answer?: {
    id: string;
    rating: number | null;
    textAnswer: string | null;
  } | null;
}

export interface SelfReviewData {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewType: string;
    status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
    updatedAt: string;
  };
  questions: QuestionWithAnswer[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get self-review for current user in cycle
 * Auto-creates if doesn't exist
 */
export async function getSelfReview(cycleId: string): Promise<SelfReviewData> {
  return fetchWithAuth(`${API_URL}/reviews/self/${cycleId}`);
}

/**
 * Save draft answers (auto-save)
 */
export async function saveDraft(
  cycleId: string,
  answers: Answer[],
): Promise<{ message: string; updatedAt: string }> {
  return fetchWithAuth(`${API_URL}/reviews/self/${cycleId}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  });
}

/**
 * Submit review (final)
 */
export async function submitReview(
  cycleId: string,
  answers: Answer[],
): Promise<{ message: string }> {
  return fetchWithAuth(`${API_URL}/reviews/self/${cycleId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

// ============================================================================
// Manager Review API Functions
// ============================================================================

export interface EmployeeToReview {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  reviewStatus: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
}

export interface ManagerReviewData {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewType: string;
    status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
    updatedAt: string;
  };
  questions: QuestionWithAnswer[];
  employeeSelfReview: {
    status: string;
    questions: QuestionWithAnswer[];
  } | null;
  employee: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Get list of employees assigned to current manager for review
 */
export function getEmployeesToReview(cycleId: string): Promise<EmployeeToReview[]> {
  return cachedFetch(
    `reviews:manager-list:${cycleId}`,
    () => fetchWithAuth(`${API_URL}/reviews/manager/${cycleId}`),
    30_000,
  );
}

/**
 * Get manager review form for specific employee with their self-review
 */
export async function getManagerReview(
  cycleId: string,
  employeeId: string,
): Promise<ManagerReviewData> {
  return fetchWithAuth(`${API_URL}/reviews/manager/${cycleId}/${employeeId}`);
}

/**
 * Save or submit manager review
 */
export async function saveManagerReview(
  cycleId: string,
  employeeId: string,
  answers: Answer[],
  submit: boolean = false,
): Promise<{ message: string; updatedAt?: string }> {
  return fetchWithAuth(`${API_URL}/reviews/manager/${cycleId}/${employeeId}`, {
    method: 'POST',
    body: JSON.stringify({ answers, submit }),
  });
}

// ============================================================================
// Downward Review API Functions (Manager evaluating team member)
// ============================================================================

/**
 * Get list of employees assigned to current manager for downward review
 */
export function getEmployeesToReviewDownward(cycleId: string): Promise<EmployeeToReview[]> {
  return cachedFetch(
    `reviews:downward-list:${cycleId}`,
    () => fetchWithAuth(`${API_URL}/reviews/downward/${cycleId}`),
    30_000,
  );
}

/**
 * Get downward review form for specific employee (manager evaluating team member)
 */
export async function getDownwardReview(
  cycleId: string,
  employeeId: string,
): Promise<ManagerReviewData> {
  return fetchWithAuth(`${API_URL}/reviews/downward/${cycleId}/${employeeId}`);
}

/**
 * Save or submit downward review
 */
export async function saveDownwardReview(
  cycleId: string,
  employeeId: string,
  answers: Answer[],
  submit: boolean = false,
): Promise<{ message: string; updatedAt?: string }> {
  return fetchWithAuth(`${API_URL}/reviews/downward/${cycleId}/${employeeId}`, {
    method: 'POST',
    body: JSON.stringify({ answers, submit }),
  });
}

// ============================================================================
// Peer Review API Functions
// ============================================================================

export interface PeerReviewData {
  review: {
    id: string;
    reviewCycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewType: string;
    status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
    updatedAt: string;
  };
  questions: QuestionWithAnswer[];
  employee: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Get list of employees assigned to current peer for review
 */
export function getEmployeesToReviewAsPeer(cycleId: string): Promise<EmployeeToReview[]> {
  return cachedFetch(
    `reviews:peer-list:${cycleId}`,
    () => fetchWithAuth(`${API_URL}/reviews/peer/${cycleId}`),
    30_000,
  );
}

/**
 * Get peer review form for specific employee
 * Does NOT include employee's self-review
 */
export async function getPeerReview(
  cycleId: string,
  employeeId: string,
): Promise<PeerReviewData> {
  return fetchWithAuth(`${API_URL}/reviews/peer/${cycleId}/${employeeId}`);
}

/**
 * Save or submit peer review
 */
export async function savePeerReview(
  cycleId: string,
  employeeId: string,
  answers: Answer[],
  submit: boolean = false,
): Promise<{ message: string; updatedAt?: string }> {
  return fetchWithAuth(`${API_URL}/reviews/peer/${cycleId}/${employeeId}`, {
    method: 'POST',
    body: JSON.stringify({ answers, submit }),
  });
}
