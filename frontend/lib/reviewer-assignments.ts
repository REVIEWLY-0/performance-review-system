import { fetchWithAuth } from './api';
import { cachedFetch, invalidateCache } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Type definitions
export interface ReviewerAssignment {
  id: string;
  reviewCycleId: string;
  employeeId: string;
  reviewerId: string;
  reviewerType: 'MANAGER' | 'PEER';
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeAssignments {
  employee: {
    id: string;
    name: string;
    email: string;
  };
  managers: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  peers: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

export interface CreateAssignmentDto {
  reviewerId: string;
  reviewerType: 'MANAGER' | 'PEER';
}

export interface BulkCreateAssignmentsDto {
  reviewCycleId: string;
  employeeId: string;
  assignments: CreateAssignmentDto[];
}

export interface ImportAssignmentDto {
  employeeEmail: string;
  reviewerEmail: string;
  reviewerType: 'MANAGER' | 'PEER';
}

export interface ImportResult {
  successful: number;
  failed: number;
  errors: string[];
}

// API functions
export const reviewerAssignmentsApi = {
  /**
   * Get all assignments for a review cycle, grouped by employee
   */
  getByCycle: (reviewCycleId: string): Promise<EmployeeAssignments[]> =>
    cachedFetch(
      `assignments:cycle:${reviewCycleId}`,
      () => fetchWithAuth(`${API_URL}/reviewer-assignments?reviewCycleId=${reviewCycleId}`),
      30_000,
    ),

  /**
   * Create/update assignments for a single employee
   */
  upsertForEmployee: async (
    dto: BulkCreateAssignmentsDto,
  ): Promise<ReviewerAssignment[]> => {
    const result = await fetchWithAuth(`${API_URL}/reviewer-assignments`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    invalidateCache(`assignments:cycle:${dto.reviewCycleId}`);
    return result;
  },

  /**
   * Bulk upsert for multiple employees
   */
  bulkUpsert: async (
    assignments: BulkCreateAssignmentsDto[],
  ): Promise<ImportResult> => {
    const result = await fetchWithAuth(`${API_URL}/reviewer-assignments/bulk`, {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    });
    // Invalidate all cycle caches since bulk can affect multiple cycles
    invalidateCache('assignments:cycle:');
    return result;
  },

  /**
   * Import assignments from Excel/CSV
   */
  importAssignments: async (
    reviewCycleId: string,
    assignments: ImportAssignmentDto[],
  ): Promise<ImportResult> => {
    const result = await fetchWithAuth(`${API_URL}/reviewer-assignments/import`, {
      method: 'POST',
      body: JSON.stringify({ reviewCycleId, assignments }),
    });
    invalidateCache(`assignments:cycle:${reviewCycleId}`);
    return result;
  },

  /**
   * Delete a specific assignment
   */
  remove: async (id: string): Promise<{ message: string }> => {
    const result = await fetchWithAuth(`${API_URL}/reviewer-assignments/${id}`, {
      method: 'DELETE',
    });
    invalidateCache('assignments:cycle:');
    return result;
  },

  /**
   * Delete all assignments for an employee in a cycle
   */
  removeAllForEmployee: async (
    employeeId: string,
    reviewCycleId: string,
  ): Promise<{ message: string; count: number }> => {
    const result = await fetchWithAuth(
      `${API_URL}/reviewer-assignments/employee/${employeeId}?reviewCycleId=${reviewCycleId}`,
      { method: 'DELETE' },
    );
    invalidateCache(`assignments:cycle:${reviewCycleId}`);
    return result;
  },
};
