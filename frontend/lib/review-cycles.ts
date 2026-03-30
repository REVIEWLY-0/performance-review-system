import { fetchWithAuth, PaginatedResponse } from './api';
import { getCached, setCache, invalidateCache } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Type definitions
export type ReviewCycleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type ReviewType = 'SELF' | 'MANAGER' | 'PEER';

export interface ReviewConfig {
  id?: string;
  stepNumber: number;
  reviewType: ReviewType;
  customTypeKey?: string; // Set when using a custom ReviewTypeConfig; reviewType stores base behavior
  name?: string;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewCycle {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ReviewCycleStatus;
  reviewConfigs: ReviewConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewCycleDto {
  name: string;
  startDate: string;
  endDate: string;
  reviewConfigs: Omit<ReviewConfig, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface UpdateReviewCycleDto {
  name?: string;
  startDate?: string;
  endDate?: string;
}

// ── Insights types ────────────────────────────────────────────────────────────
export type ReviewStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';

export interface ReviewerStatus {
  reviewer: { id: string; name: string; email: string };
  status: ReviewStatus;
}

export interface EmployeeInsight {
  id: string;
  name: string;
  email: string;
  department: string | null;
  departments: { id: string; name: string }[];
  selfReviewStatus: ReviewStatus;
  managerReviews: ReviewerStatus[];
  peerReviews: ReviewerStatus[];
}

export interface CycleInsights {
  cycle: ReviewCycle;
  stats: {
    total: number;
    fullyComplete: number;
    inProgress: number;
    notStarted: number;
  };
  employees: EmployeeInsight[];
}

// API functions
export const reviewCyclesApi = {
  /**
   * Get all review cycles, optionally filtered by status
   */
  getAll: async (status?: ReviewCycleStatus): Promise<PaginatedResponse<ReviewCycle>> => {
    const key = `cycles:all:${status ?? 'all'}`;
    const cached = getCached<PaginatedResponse<ReviewCycle>>(key);
    if (cached) return cached;
    const url = status
      ? `${API_URL}/review-cycles?status=${status}&limit=200`
      : `${API_URL}/review-cycles?limit=200`;
    const data = await fetchWithAuth(url);
    setCache(key, data, 5_000); // 5s TTL — short enough to catch admin activations quickly
    return data;
  },

  /**
   * Get a single review cycle by ID
   */
  getOne: async (id: string): Promise<ReviewCycle> => {
    return fetchWithAuth(`${API_URL}/review-cycles/${id}`);
  },

  /**
   * Create a new review cycle with workflow configs
   */
  create: async (dto: CreateReviewCycleDto): Promise<ReviewCycle> => {
    return fetchWithAuth(`${API_URL}/review-cycles`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Update review cycle basic info (name, dates)
   */
  update: async (
    id: string,
    dto: UpdateReviewCycleDto,
  ): Promise<ReviewCycle> => {
    const result = await fetchWithAuth(`${API_URL}/review-cycles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    invalidateCache('cycles:');
    return result;
  },

  /**
   * Update workflow step configurations
   */
  updateConfigs: async (
    id: string,
    configs: Omit<ReviewConfig, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Promise<ReviewCycle> => {
    const result = await fetchWithAuth(`${API_URL}/review-cycles/${id}/configs`, {
      method: 'PUT',
      body: JSON.stringify({ configs }),
    });
    invalidateCache('cycles:');
    return result;
  },

  /**
   * Activate a review cycle (DRAFT -> ACTIVE)
   */
  activate: async (id: string): Promise<ReviewCycle> => {
    const result = await fetchWithAuth(`${API_URL}/review-cycles/${id}/activate`, {
      method: 'POST',
    });
    invalidateCache('cycles:');
    return result;
  },

  /**
   * Complete a review cycle (ACTIVE -> COMPLETED)
   */
  complete: async (id: string): Promise<ReviewCycle> => {
    const result = await fetchWithAuth(`${API_URL}/review-cycles/${id}/complete`, {
      method: 'POST',
    });
    invalidateCache('cycles:');
    return result;
  },

  /**
   * Delete a review cycle (DRAFT cycles only)
   */
  delete: async (id: string): Promise<void> => {
    const result = await fetchWithAuth(`${API_URL}/review-cycles/${id}`, {
      method: 'DELETE',
    });
    invalidateCache('cycles:');
    return result;
  },

  /**
   * Get HR insights for a cycle: completion matrix, stats, per-employee status
   */
  getInsights: async (id: string): Promise<CycleInsights> => {
    const key = `cycles:insights:${id}`;
    const cached = getCached<CycleInsights>(key);
    if (cached) return cached;
    const data = await fetchWithAuth(`${API_URL}/review-cycles/${id}/insights`);
    setCache(key, data, 30_000); // 30s — stale-while-revalidate for the heavy HR panel
    return data;
  },
};

// Helper functions
export function getStatusColor(status: ReviewCycleStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'gray';
    case 'ACTIVE':
      return 'green';
    case 'COMPLETED':
      return 'blue';
    default:
      return 'gray';
  }
}

export function getReviewTypeColor(type: ReviewType): string {
  switch (type) {
    case 'SELF':
      return 'blue';
    case 'MANAGER':
      return 'green';
    case 'PEER':
      return 'purple';
    default:
      return 'gray';
  }
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
