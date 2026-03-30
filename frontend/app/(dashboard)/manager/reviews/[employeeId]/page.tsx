'use client';

import { useEffect, useRef, useState } from 'react';
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
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
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
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => { handleAutoSave(); }, 30000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
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

      if (data.review.updatedAt) setLastSaved(new Date(data.review.updatedAt));
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
      const result = await saveDownwardReview(cycleId, params.employeeId, answersToSave, false);
      if (result.updatedAt) setLastSaved(new Date(result.updatedAt));
      setDirtyAnswers(new Set());
    } catch (err: any) {
      console.error('Auto-save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateAnswer = (questionId: string, updates: Partial<Omit<Answer, 'questionId'>>) => {
    const currentAnswer = answers.get(questionId) || { questionId, rating: null, textAnswer: null };
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, { ...currentAnswer, ...updates });
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
      if (q.type === 'RATING' && answer.rating && answer.rating > 0) answered++;
      else if (q.type === 'TEXT' && answer.textAnswer?.trim()) answered++;
      else if (q.type === 'TASK_LIST' && answer.textAnswer) {
        try {
          const tasks = JSON.parse(answer.textAnswer);
          if (tasks.tasks && tasks.tasks.length > 0) answered++;
        } catch { /* invalid JSON */ }
      }
    });
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  };

  const handleSubmit = async () => {
    if (!cycleId) return;
    const progress = calculateProgress();
    if (progress.percentage < 100) {
      setError(`Please answer all questions before submitting (${progress.answered}/${progress.total} completed)`);
      return;
    }
    setConfirmDialog({
      title: 'Submit Review',
      message: 'Are you sure you want to submit this review? This cannot be undone.',
      onConfirm: async () => {
        try {
          setSaving(true);
          setError('');
          await saveDownwardReview(cycleId, params.employeeId, Array.from(answers.values()), true);
          router.push(`/manager/reviews?cycleId=${cycleId}`);
        } catch (err: any) {
          setConfirmDialog(null);
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
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
          <p className="text-sm text-red-700">{error || 'Review data not found'}</p>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const isSubmitted = reviewData.review.status === 'SUBMITTED';

  return (
    <div className="px-4 py-6 sm:px-0 max-w-3xl">
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
        <p className="mt-1 text-sm text-on-surface-variant">{reviewData.employee.email}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Submitted banner */}
      {isSubmitted && (
        <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">This review has been submitted.</p>
        </div>
      )}

      {/* Progress bar */}
      {!isSubmitted && (
        <div className="mb-6 bg-surface-container-lowest shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-on-surface-variant">
              Progress: {progress.answered}/{progress.total} ({progress.percentage}%)
            </span>
            <span className="text-xs text-on-surface-variant">
              {saving ? 'Saving draft…' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
            </span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {reviewData.questions.map((question, idx) => (
          <QuestionCard
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

      {/* Submit */}
      {!isSubmitted && (
        <div className="sticky bottom-6 mt-6 bg-surface-container-lowest shadow-lg rounded-lg p-4 border-2 border-primary">
          <button
            onClick={handleSubmit}
            disabled={progress.percentage < 100 || saving}
            className="w-full px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit Review'}
          </button>
          {progress.percentage < 100 && (
            <p className="mt-2 text-xs text-center text-on-surface-variant">
              Complete all questions to submit
            </p>
          )}
        </div>
      )}

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

function QuestionCard({
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
  onUpdate: (questionId: string, updates: Partial<Omit<Answer, 'questionId'>>) => void;
  disabled: boolean;
  ratingScale: RatingScale;
}) {
  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <h3 className="text-sm font-medium text-on-surface mb-4">
        Q{number}. {question.text}
      </h3>

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
            <summary className="cursor-pointer hover:text-on-surface select-none">View scale definitions</summary>
            <div className="mt-2 space-y-1 bg-surface-container-low rounded-md p-3">
              {ratingScale.labels.map((label) => (
                <div key={label.value} className="flex gap-2">
                  <span className="font-semibold w-4 shrink-0 text-on-surface-variant">{label.value}</span>
                  <span className="font-medium text-on-surface">{label.title}</span>
                  {label.description && <span className="text-on-surface-variant">— {label.description}</span>}
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
            onChange={(e) => onUpdate(question.id, { textAnswer: e.target.value })}
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

function TaskListInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const tasks = value ? JSON.parse(value).tasks : [{ text: '', completed: false }];

  const updateTasks = (newTasks: any[]) => onChange(JSON.stringify({ tasks: newTasks }));
  const addTask = () => updateTasks([...tasks, { text: '', completed: false }]);
  const removeTask = (idx: number) => updateTasks(tasks.filter((_: any, i: number) => i !== idx));
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
            <button type="button" onClick={() => removeTask(idx)} className="text-red-600 hover:text-red-800 text-xl px-2">×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={addTask} className="text-sm text-primary hover:text-primary-dim font-medium">
          + Add task
        </button>
      )}
    </div>
  );
}
