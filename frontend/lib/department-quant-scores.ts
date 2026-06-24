import { fetchWithAuth } from './api';
import { cachedFetch, invalidateCache } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DepartmentQuantScoreEntry {
  department: { id: string; name: string };
  score: number | null;
  note: string | null;
  setBy: { id: string; name: string } | null;
  updatedAt: string | null;
}

export interface UpsertDepartmentQuantScoreDto {
  cycleId: string;
  departmentId: string;
  score: number;
  note?: string;
}

export const departmentQuantScoresApi = {
  getByCycle: (cycleId: string): Promise<DepartmentQuantScoreEntry[]> =>
    cachedFetch(
      `dept-quant-scores:${cycleId}`,
      () => fetchWithAuth(`${API_URL}/department-quant-scores?cycleId=${cycleId}`),
      30_000,
    ),

  upsert: async (dto: UpsertDepartmentQuantScoreDto): Promise<void> => {
    await fetchWithAuth(`${API_URL}/department-quant-scores`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    invalidateCache(`dept-quant-scores:${dto.cycleId}`);
  },
};
