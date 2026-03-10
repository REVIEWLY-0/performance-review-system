import { fetchWithAuth } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type BaseReviewType = 'SELF' | 'MANAGER' | 'PEER';

export interface ReviewTypeConfig {
  id: string;
  companyId: string;
  key: string;
  label: string;
  baseType: BaseReviewType;
  isBuiltIn: boolean;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewTypeConfigDto {
  label: string;
  baseType: BaseReviewType;
  key?: string;
}

export interface UpdateReviewTypeConfigDto {
  isRequired?: boolean;
  label?: string;
}

export const reviewTypeConfigsApi = {
  async getAll(): Promise<ReviewTypeConfig[]> {
    return fetchWithAuth(`${API_URL}/review-type-configs`);
  },

  async create(dto: CreateReviewTypeConfigDto): Promise<ReviewTypeConfig> {
    return fetchWithAuth(`${API_URL}/review-type-configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
  },

  async update(id: string, dto: UpdateReviewTypeConfigDto): Promise<ReviewTypeConfig> {
    return fetchWithAuth(`${API_URL}/review-type-configs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
  },

  async delete(id: string): Promise<{ message: string }> {
    return fetchWithAuth(`${API_URL}/review-type-configs/${id}`, {
      method: 'DELETE',
    });
  },
};
