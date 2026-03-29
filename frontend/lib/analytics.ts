import { fetchWithAuth } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================================================
// Types
// ============================================================================

export interface EmployeeScore {
  id: string;
  name: string;
  email: string;
  score: number | null;
}

export interface AdminAnalytics {
  totalEmployees: number;
  activeEmployees: number;
  completionRate: number;
  averageScore: number | null;
  topPerformers: EmployeeScore[];
  pendingReviews: {
    selfReviews: number;
    managerReviews: number;
    peerReviews: number;
  };
  reviewProgress: {
    submitted: number;
    draft: number;
    notStarted: number;
  };
}

export interface ManagerAnalytics {
  teamSize: number;
  teamAverageScore: number | null;
  companyAverageScore: number | null;
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    score: number | null;
    reviewsCompleted: number;
    reviewsTotal: number;
  }>;
  pendingReviews: number;
}

export interface EmployeeAnalytics {
  personalScore: number | null;
  allReviewsComplete: boolean;
  companyAverage: number | null;
  scoreBreakdown: {
    self: number | null;
    manager: number | null;
    peer: number | null;
  };
  pendingTasks: {
    selfReview: boolean;
    peerReviews: number;
    managerReviews: number;
  };
  taskCounts: {
    selfTotal: number;
    peerTotal: number;
    managerTotal: number;
    selfCompleted: number;
    peerCompleted: number;
    managerCompleted: number;
  };
  reviewCounts: {
    self: number;
    manager: number;
    peer: number;
  };
}

// ============================================================================
// API Functions
// ============================================================================

export async function getAdminAnalytics(
  cycleId: string,
): Promise<AdminAnalytics> {
  return fetchWithAuth(`${API_URL}/analytics/admin/${cycleId}`);
}

export async function getManagerAnalytics(
  cycleId: string,
): Promise<ManagerAnalytics> {
  return fetchWithAuth(`${API_URL}/analytics/manager/${cycleId}`);
}

export async function getEmployeeAnalytics(
  cycleId: string,
): Promise<EmployeeAnalytics> {
  return fetchWithAuth(`${API_URL}/analytics/employee/${cycleId}`);
}
