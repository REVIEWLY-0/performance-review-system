import { fetchWithAuth } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ReceivedAnswer {
  questionId: string;
  questionText: string;
  questionType: string;
  rating: number | null;
  textAnswer: string | null;
}

export interface AttributedReview {
  reviewType: string;
  status: string;
  reviewer: { name: string; email: string };
  answers: ReceivedAnswer[];
}

export interface AnonymousReviewEntry {
  reviewType: string;
  status: string;
  answers: ReceivedAnswer[];
}

export interface AnonymousSection {
  withheld: false;
  count: number;
  threshold: number;
  reviews: AnonymousReviewEntry[];
}

export interface WithheldSection {
  withheld: true;
  count: number;
  threshold: number;
  aggregated: { avgRating: number | null };
}

export interface ReceivedReviewsResponse {
  locked: boolean;
  cycleStatus?: string;
  cycleId?: string;
  self?: AttributedReview[];
  manager?: AttributedReview[];
  peer?: AnonymousSection | WithheldSection;
  upward?: AnonymousSection | WithheldSection;
}

export async function getMyReceivedReviews(cycleId: string): Promise<ReceivedReviewsResponse> {
  return fetchWithAuth(`${API_URL}/reviews/received?cycleId=${cycleId}`);
}
