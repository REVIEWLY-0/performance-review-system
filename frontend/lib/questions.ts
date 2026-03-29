import { fetchWithAuth } from './api';

export type QuestionType = 'RATING' | 'TEXT' | 'TASK_LIST';
export type ReviewType = 'SELF' | 'MANAGER' | 'PEER' | 'DOWNWARD';

export interface TaskDefinition {
  id: string;
  label: string;
  description?: string;
  required: boolean;
}

export interface Question {
  id: string;
  companyId: string;
  reviewType: ReviewType;
  type: QuestionType;
  text: string;
  maxChars?: number;
  tasks?: TaskDefinition[] | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionDto {
  reviewType: ReviewType;
  type: QuestionType;
  text: string;
  maxChars?: number;
  tasks?: TaskDefinition[];
  order?: number;
}

export interface UpdateQuestionDto {
  reviewType?: ReviewType;
  type?: QuestionType;
  text?: string;
  maxChars?: number;
  tasks?: TaskDefinition[] | null;
  order?: number;
}

export interface GroupedQuestions {
  SELF: Question[];
  MANAGER: Question[];
  PEER: Question[];
  DOWNWARD: Question[];
}

/**
 * Get all questions, optionally filtered by review type
 */
export async function getQuestions(reviewType?: ReviewType): Promise<Question[]> {
  const url = reviewType
    ? `${process.env.NEXT_PUBLIC_API_URL}/questions?reviewType=${reviewType}`
    : `${process.env.NEXT_PUBLIC_API_URL}/questions`;

  return fetchWithAuth(url);
}

/**
 * Get questions grouped by review type
 */
export async function getGroupedQuestions(): Promise<GroupedQuestions> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/grouped`);
}

/**
 * Get a single question by ID
 */
export async function getQuestion(id: string): Promise<Question> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/${id}`);
}

/**
 * Create a new question
 */
export async function createQuestion(dto: CreateQuestionDto): Promise<Question> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/**
 * Update a question
 */
export async function updateQuestion(id: string, dto: UpdateQuestionDto): Promise<Question> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

/**
 * Delete a question
 */
export async function deleteQuestion(id: string): Promise<void> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder questions within a review type
 */
export async function reorderQuestions(
  reviewType: ReviewType,
  questionIds: string[],
): Promise<{ message: string }> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/reorder`, {
    method: 'POST',
    body: JSON.stringify({ reviewType, questionIds }),
  });
}

/**
 * Duplicate a question
 */
export async function duplicateQuestion(id: string): Promise<Question> {
  return fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/questions/${id}/duplicate`, {
    method: 'POST',
  });
}
