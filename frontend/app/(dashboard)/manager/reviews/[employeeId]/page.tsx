'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getDownwardReview,
  saveDownwardReview,
  ManagerReviewData,
  Answer,
  QuestionWithAnswer,
} from '@/lib/reviews';
import { ratingScaleApi, RatingScale, DEFAULT_SCALE } from '@/lib/rating-scale';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ManagerReviewPageProps {
  params: {
    employeeId: string;
  };
}

export default function ManagerReviewPage({ params }: ManagerReviewPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get('cycleId');

  const [reviewData, setReviewData] = useState<ManagerReviewData | null>(null);
  const [ratingScale, setRatingScale] = useState<RatingScale>(DEFAULT_SCALE);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [dirtyAnswers, setDirtyAnswers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void | Promise<void>;
  } | null>(null);

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!cycleId) {
      setError('Review cycle not specified');
      setLoading(false);
      return;
    }
    loadReviewData();
  }, [cycleId, params.employeeId]);

  // Auto-save effect
  useEffect(() => {
    if (dirtyAnswers.size > 0 && reviewData?.review.status !== 'SUBMITTED') {
      // Clear existing timer
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }

      // Set new timer for 30 seconds
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave();
      }, 30000);
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [dirtyAnswers]);

  const loadReviewData = async () => {
    if (!cycleId) return;

    try {
      setLoading(true);
      setError('');
      const [data, scale] = await Promise.all([
        getDownwardReview(cycleId, params.employeeId),
        ratingScaleApi.get(),
      ]);
      setReviewData(data);
      setRatingScale(scale);

      // Initialize answers map
      const initialAnswers = new Map<string, Answer>();
      data.questions.forEach((q) => {
        if (q.answer) {
          initialAnswers.set(q.id, {
            questionId: q.id,
            rating: q.answer.rating,
            textAnswer: q.answer.textAnswer,
          });
        }
      });
      setAnswers(initialAnswers);
      setDirtyAnswers(new Set());

      if (data.review.updatedAt) {
        setLastSaved(new Date(data.review.updatedAt));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load review');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = async () => {
    if (!cycleId || dirtyAnswers.size === 0) return;

    try {
      setSaving(true);
      const answersToSave = Array.from(dirtyAnswers)
        .map((qId) => answers.get(qId))
        .filter((a): a is Answer => a !== undefined);

      const result = await saveDownwardReview(
        cycleId,
        params.employeeId,
        answersToSave,
        false,
      );

      if (result.updatedAt) {
        setLastSaved(new Date(result.updatedAt));
      }
      setDirtyAnswers(new Set());
    } catch (err: any) {
      console.error('Auto-save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateAnswer = (
    questionId: string,
    updates: Partial<Omit<Answer, 'questionId'>>,
  ) => {
    const currentAnswer = answers.get(questionId) || {
      questionId,
      rating: null,
      textAnswer: null,
    };

    const updatedAnswer = { ...currentAnswer, ...updates };
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, updatedAnswer);
    setAnswers(newAnswers);

    const newDirty = new Set(dirtyAnswers);
    newDirty.add(questionId);
    setDirtyAnswers(newDirty);
  };

  const calculateProgress = () => {
    if (!reviewData) return { answered: 0, total: 0, percentage: 0 };

    const total = reviewData.questions.length;
    let answered = 0;

    reviewData.questions.forEach((q) => {
      const answer = answers.get(q.id);
      if (!answer) return;

      if (q.type === 'RATING' && answer.rating && answer.rating > 0) {
        answered++;
      } else if (q.type === 'TEXT' && answer.textAnswer?.trim()) {
        answered++;
      } else if (q.type === 'TASK_LIST' && answer.textAnswer) {
        try {
          const tasks = JSON.parse(answer.textAnswer);
          if (tasks.tasks && tasks.tasks.length > 0) {
            answered++;
          }
        } catch (e) {
          // Invalid JSON, not answered
        }
      }
    });

    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  };

  const handleSubmit = async () => {
    if (!cycleId) return;

    const progress = calculateProgress();
    if (progress.percentage < 100) {
      setError(
        `Please answer all questions before submitting (${progress.answered}/${progress.total} completed)`,
      );
      return;
    }

    setConfirmDialog({
      title: 'Submit Review',
      message: 'Are you sure you want to submit this review? This cannot be undone.',
      onConfirm: async () => {
        try {
          setSaving(true);
          setError('');
          const allAnswers = Array.from(answers.values());
          await saveDownwardReview(cycleId, params.employeeId, allAnswers, true);
          router.push(`/manager/reviews?cycleId=${cycleId}`);
        } catch (err: any) {
          setError(err.message || 'Failed to submit review');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-on-surface-variant">Loading review...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reviewData || !cycleId) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error || 'Review data not found'}
          </p>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const isSubmitted = reviewData.review.status === 'SUBMITTED';

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/manager/reviews?cycleId=${cycleId}`)}
          className="text-sm text-primary hover:text-primary-dim mb-2"
        >
          ← Back to Reviews
        </button>
        <h1 className="text-2xl font-bold text-on-surface">
          Review: {reviewData.employee.name}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {reviewData.employee.email}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {!isSubmitted && (
        <div className="mb-6 bg-surface-container-lowest shadow rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-on-surface-variant">
                Progress: {progress.answered}/{progress.total} (
                {progress.percentage}%)
              </span>
              {saving && (
                <span className="text-xs text-on-surface-variant">Saving draft...</span>
              )}
              {lastSaved && !saving && (
                <span className="text-xs text-on-surface-variant">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Employee Self-Review */}
        <div className="space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-1">
              Employee Self-Review
            </h2>
            <p className="text-sm text-blue-700">
              {reviewData.employeeSelfReview
                ? `Status: ${reviewData.employeeSelfReview.status}`
                : 'Not submitted yet'}
            </p>
          </div>

          {reviewData.employeeSelfReview ? (
            <div className="space-y-4">
              {reviewData.employeeSelfReview.questions.map((question, idx) => (
                <SelfReviewQuestionCard
                  key={question.id}
                  question={question}
                  number={idx + 1}
                  ratingScale={ratingScale}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow rounded-lg p-6 text-center">
              <p className="text-on-surface-variant">
                This employee has not completed their self-review yet.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Manager Review Form */}
        <div className="space-y-4">
          <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4">
            <h2 className="text-lg font-semibold text-indigo-900 mb-1">
              Your Manager Review
            </h2>
            <p className="text-sm text-indigo-700">
              Status: {reviewData.review.status}
            </p>
          </div>

          <div className="space-y-4">
            {reviewData.questions.map((question, idx) => (
              <ManagerQuestionCard
                key={question.id}
                question={question}
                number={idx + 1}
                answer={answers.get(question.id)}
                onUpdate={updateAnswer}
                disabled={isSubmitted}
                ratingScale={ratingScale}
              />
            ))}
          </div>

          {/* Submit Button */}
          {!isSubmitted && (
            <div className="sticky bottom-6 bg-surface-container-lowest shadow-lg rounded-lg p-4 border-2 border-primary">
              <button
                onClick={handleSubmit}
                disabled={progress.percentage < 100 || saving}
                className="w-full px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Submitting...' : 'Submit Review'}
              </button>
              {progress.percentage < 100 && (
                <p className="mt-2 text-xs text-center text-on-surface-variant">
                  Complete all questions to submit
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

// Self-Review Question Card (Read-Only)
function SelfReviewQuestionCard({
  question,
  number,
  ratingScale,
}: {
  question: QuestionWithAnswer;
  number: number;
  ratingScale: RatingScale;
}) {
  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-on-surface">
          Q{number}. {question.text}
        </h3>
      </div>

      <div className="bg-surface-container-low rounded-md p-4">
        {question.type === 'RATING' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: ratingScale.maxRating }, (_, i) => i + 1).map((num) => (
                <div
                  key={num}
                  className={`min-w-[40px] flex-1 px-3 py-2 border-2 rounded-lg text-center font-medium ${
                    question.answer?.rating === num
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-outline-variant text-on-surface-variant'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant px-1">
              <span>{ratingScale.labels[0]?.title ?? 'Poor'}</span>
              <span>{ratingScale.labels[ratingScale.maxRating - 1]?.title ?? 'Excellent'}</span>
            </div>
          </div>
        )}

        {question.type === 'TEXT' && (
          <p className="text-sm text-on-surface-variant whitespace-pre-wrap">
            {question.answer?.textAnswer || (
              <span className="text-on-surface-variant italic">No answer provided</span>
            )}
          </p>
        )}

        {question.type === 'TASK_LIST' && (
          <div className="space-y-2">
            {question.answer?.textAnswer ? (
              JSON.parse(question.answer.textAnswer).tasks.map(
                (task: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      disabled
                      className="h-4 w-4 text-blue-600 border-outline rounded"
                    />
                    <span className="text-sm text-on-surface-variant">{task.text}</span>
                  </div>
                ),
              )
            ) : (
              <span className="text-on-surface-variant italic text-sm">
                No tasks provided
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Manager Question Card (Editable)
function ManagerQuestionCard({
  question,
  number,
  answer,
  onUpdate,
  disabled,
  ratingScale,
}: {
  question: QuestionWithAnswer;
  number: number;
  answer?: Answer;
  onUpdate: (
    questionId: string,
    updates: Partial<Omit<Answer, 'questionId'>>,
  ) => void;
  disabled: boolean;
  ratingScale: RatingScale;
}) {
  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-on-surface">
          Q{number}. {question.text}
        </h3>
      </div>

      {question.type === 'RATING' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: ratingScale.maxRating }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => !disabled && onUpdate(question.id, { rating: num })}
                disabled={disabled}
                className={`min-w-[48px] flex-1 px-3 py-4 border-2 rounded-lg font-medium transition-colors ${
                  answer?.rating === num
                    ? 'border-primary bg-indigo-50 text-indigo-700'
                    : 'border-outline text-on-surface-variant hover:border-primary hover:bg-indigo-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant px-1">
            <span>{ratingScale.labels[0]?.title ?? 'Poor'}</span>
            <span>{ratingScale.labels[ratingScale.maxRating - 1]?.title ?? 'Excellent'}</span>
          </div>
          <details className="text-xs text-on-surface-variant">
            <summary className="cursor-pointer hover:text-on-surface select-none">
              View scale definitions
            </summary>
            <div className="mt-2 space-y-1 bg-surface-container-low rounded-md p-3">
              {ratingScale.labels.map((label) => (
                <div key={label.value} className="flex gap-2">
                  <span className="font-semibold w-4 shrink-0 text-on-surface-variant">{label.value}</span>
                  <span className="font-medium text-on-surface">{label.title}</span>
                  {label.description && (
                    <span className="text-on-surface-variant">— {label.description}</span>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {question.type === 'TEXT' && (
        <div>
          <textarea
            value={answer?.textAnswer || ''}
            onChange={(e) =>
              onUpdate(question.id, { textAnswer: e.target.value })
            }
            disabled={disabled}
            maxLength={question.maxChars || undefined}
            rows={5}
            className="w-full px-4 py-3 border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-surface-container-high disabled:cursor-not-allowed"
            placeholder="Enter your response..."
          />
          {question.maxChars && (
            <div className="text-right text-sm text-on-surface-variant mt-1">
              {answer?.textAnswer?.length || 0} / {question.maxChars}
            </div>
          )}
        </div>
      )}

      {question.type === 'TASK_LIST' && (
        <TaskListInput
          value={answer?.textAnswer || ''}
          onChange={(value) => onUpdate(question.id, { textAnswer: value })}
          disabled={disabled}
        />
      )}
    </div>
  );
}

// Task List Input Component
function TaskListInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const tasks = value
    ? JSON.parse(value).tasks
    : [{ text: '', completed: false }];

  const updateTasks = (newTasks: any[]) => {
    onChange(JSON.stringify({ tasks: newTasks }));
  };

  const addTask = () => {
    updateTasks([...tasks, { text: '', completed: false }]);
  };

  const removeTask = (idx: number) => {
    updateTasks(tasks.filter((_: any, i: number) => i !== idx));
  };

  const updateTask = (idx: number, updates: any) => {
    const newTasks = [...tasks];
    newTasks[idx] = { ...newTasks[idx], ...updates };
    updateTasks(newTasks);
  };

  return (
    <div className="space-y-3">
      {tasks.map((task: any, idx: number) => (
        <div key={idx} className="flex gap-3 items-start">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(e) => updateTask(idx, { completed: e.target.checked })}
            disabled={disabled}
            className="h-5 w-5 text-indigo-600 border-outline rounded mt-2"
          />
          <input
            type="text"
            value={task.text}
            onChange={(e) => updateTask(idx, { text: e.target.value })}
            disabled={disabled}
            placeholder="Enter task..."
            className="flex-1 px-3 py-2 border border-outline rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-surface-container-high disabled:cursor-not-allowed"
          />
          {!disabled && tasks.length > 1 && (
            <button
              type="button"
              onClick={() => removeTask(idx)}
              className="text-red-600 hover:text-red-800 text-xl px-2"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={addTask}
          className="text-sm text-primary hover:text-primary-dim font-medium"
        >
          + Add task
        </button>
      )}
    </div>
  );
}
