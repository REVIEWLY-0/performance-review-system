import { fetchWithAuth } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface EmployeeGoal {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  title: string;
  description: string | null;
  rating: number | null;
  setBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuantScore {
  id: string;
  cycleId: string;
  employeeId: string;
  score: number;
  note: string | null;
}

export async function listGoals(cycleId: string, employeeId: string): Promise<EmployeeGoal[]> {
  return fetchWithAuth(`${API_URL}/goals?cycleId=${cycleId}&employeeId=${employeeId}`);
}

export async function createGoal(payload: {
  cycleId: string;
  employeeId: string;
  title: string;
  description?: string;
  rating?: number;
}): Promise<EmployeeGoal> {
  return fetchWithAuth(`${API_URL}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateGoal(
  goalId: string,
  payload: { title?: string; description?: string; rating?: number | null },
): Promise<EmployeeGoal> {
  return fetchWithAuth(`${API_URL}/goals/${goalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteGoal(goalId: string): Promise<void> {
  return fetchWithAuth(`${API_URL}/goals/${goalId}`, { method: 'DELETE' });
}

export async function getQuantScore(cycleId: string, employeeId: string): Promise<QuantScore | null> {
  return fetchWithAuth(`${API_URL}/goals/quant-score?cycleId=${cycleId}&employeeId=${employeeId}`);
}

export async function upsertQuantScore(payload: {
  cycleId: string;
  employeeId: string;
  score: number;
  note?: string;
}): Promise<QuantScore> {
  return fetchWithAuth(`${API_URL}/goals/quant-score`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
