import { fetchWithAuth } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ScoreWeightConfig {
  id: string;
  companyId: string;
  quantWeight: number;
  managerWeight: number;
  peerWeight: number;
  selfWeight: number;
  minPeerThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateScoreWeightsPayload {
  quantWeight: number;
  managerWeight: number;
  peerWeight: number;
  selfWeight: number;
  minPeerThreshold?: number;
}

export async function getScoreWeights(): Promise<ScoreWeightConfig> {
  return fetchWithAuth(`${API_URL}/score-weights`);
}

export async function updateScoreWeights(
  payload: UpdateScoreWeightsPayload,
): Promise<ScoreWeightConfig> {
  return fetchWithAuth(`${API_URL}/score-weights`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
