import { fetchWithAuth } from './api';
import { getCached, setCache, invalidateCache } from './cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface RatingScaleLabel {
  value: number;
  title: string;
  description: string;
}

export interface RatingScale {
  maxRating: number;
  labels: RatingScaleLabel[];
}

export const DEFAULT_SCALE: RatingScale = {
  maxRating: 5,
  labels: [
    { value: 1, title: 'Poor', description: 'Does not meet expectations' },
    { value: 2, title: 'Below Average', description: 'Partially meets expectations' },
    { value: 3, title: 'Average', description: 'Meets expectations' },
    { value: 4, title: 'Good', description: 'Exceeds expectations in most areas' },
    { value: 5, title: 'Excellent', description: 'Consistently exceeds all expectations' },
  ],
};

export const ALL_DEFAULT_LABELS: RatingScaleLabel[] = [
  { value: 1, title: 'Poor', description: 'Does not meet expectations' },
  { value: 2, title: 'Below Average', description: 'Partially meets expectations' },
  { value: 3, title: 'Average', description: 'Meets expectations' },
  { value: 4, title: 'Good', description: 'Exceeds expectations in most areas' },
  { value: 5, title: 'Excellent', description: 'Consistently exceeds all expectations' },
  { value: 6, title: 'Outstanding', description: 'Exceptional performance' },
  { value: 7, title: 'Exemplary', description: 'Role model for the team' },
  { value: 8, title: 'Distinguished', description: 'Significantly above exceptional' },
  { value: 9, title: 'Elite', description: 'Among the top performers' },
  { value: 10, title: 'World Class', description: 'Highest possible performance' },
];

export const ratingScaleApi = {
  get: async (): Promise<RatingScale> => {
    const key = 'rating-scale:company';
    const cached = getCached<RatingScale>(key);
    if (cached) return cached;
    try {
      const data = await fetchWithAuth(`${API_URL}/rating-scale`);
      setCache(key, data, 60_000); // 1 min cache — scale changes infrequently
      return data;
    } catch {
      return DEFAULT_SCALE;
    }
  },

  update: async (dto: { maxRating: number; labels: RatingScaleLabel[] }): Promise<RatingScale> => {
    const data = await fetchWithAuth(`${API_URL}/rating-scale`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
    invalidateCache('rating-scale:');
    return data;
  },
};
