'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getPeerReview,
  savePeerReview,
  PeerReviewData,
  Answer,
  QuestionWithAnswer,
} from '@/lib/reviews';
import { ratingScaleApi, RatingScale, DEFAULT_SCALE } from '@/lib/rating-scale';
import ConfirmDialog from '@/components/ConfirmDialog';

interface PeerReviewPageProps {
  params: {
    employeeId: string;
  };
}

export default function PeerReviewPage({ params }: PeerReviewPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get('cycleId');

  const [reviewData, setReviewData] = useState<PeerReviewData | null>(null);
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

  useEffect(() => {
    if (dirtyAnswers.size > 0 && reviewData?.review.status !== 'SUBMITTED') {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => handleAutoSave(), 30000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirtyAnswers]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyAnswers.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyAnswers]);

  const handleBack = () => {
    if (dirtyAnswers.size > 0) {
      setConfirmDialog({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Leave without saving?',
        variant: 'danger',
        onConfirm: () => router.push(`/employee/reviews/peer?cycleId=${cycleId}`),
      });
      return;
    }
    router.push(`/employee/reviews/peer?cycleId=${cycleId}`);
  };

  const loadReviewData = async () => {
    if (!cycleId) return;
    try {
      setLoading(true);
      setError('');
      const [data, scale] = await Promise.all([
        getPeerReview(cycleId, params.employeeId),
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
      const result = await savePeerReview(cycleId, params.employeeId, answersToSave, false);
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
          const parsed = JSON.parse(answer.textAnswer);
          const taskList = parsed.tasks || [];
          const hasPredefined = q.tasks && q.tasks.length > 0;
          if (hasPredefined) { if (taskList.some((t: any) => t.completed)) answered++; }
          else if (taskList.length > 0) answered++;
        } catch {}
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
      message: 'Are you sure you want to submit this peer review? This cannot be undone.',
      onConfirm: async () => {
        try {
          setSaving(true);
          setError('');
          const allAnswers = Array.from(answers.values());
          await savePeerReview(cycleId, params.employeeId, allAnswers, true);
          router.push(`/employee/reviews/peer?cycleId=${cycleId}`);
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
      <div className="max-w-3xl mx-auto px-4 py-10 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-on-surface-variant">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!reviewData || !cycleId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-5">
          <p className="text-sm text-red-700 dark:text-red-400">{error || 'Review data not found'}</p>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const isSubmitted = reviewData.review.status === 'SUBMITTED';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Back to Peer Reviews
        </button>
        <h1 className="text-2xl font-bold text-on-surface">{reviewData.employee.name}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">{reviewData.employee.email}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 px-5 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5 shrink-0">error</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Submitted banner */}
      {isSubmitted && (
        <div className="mb-5 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 px-5 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-sm font-medium text-green-800 dark:text-green-300">This review has been submitted and is locked.</p>
        </div>
      )}

      {/* Progress */}
      {!isSubmitted && (
        <div className="mb-6 bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-on-surface-variant">
              {progress.answered} of {progress.total} questions answered
            </span>
            {saving ? (
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                Saving...
              </span>
            ) : lastSaved ? (
              <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <div className="w-full bg-surface-container-high dark:bg-[#222a3d] rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="mb-6 bg-surface-container-low dark:bg-[#1a2440] rounded-2xl p-4 border border-outline-variant/20 dark:border-white/[0.04]">
        <h2 className="text-sm font-semibold text-on-surface mb-0.5">Peer Review</h2>
        <p className="text-sm text-on-surface-variant">
          {isSubmitted
            ? 'Your responses are final and have been recorded.'
            : 'Your responses are confidential. Answer each question honestly.'}
        </p>
      </div>

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
        <div className="sticky bottom-6 mt-6 bg-surface-container-lowest dark:bg-[#131b2e] shadow-xl rounded-2xl p-5 border border-outline-variant/20 dark:border-white/[0.04]">
          <button
            onClick={handleSubmit}
            disabled={progress.percentage < 100 || saving}
            className="w-full py-3.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99] text-sm"
          >
            {saving ? 'Submitting...' : 'Submit Peer Review'}
          </button>
          {progress.percentage < 100 && (
            <p className="mt-2 text-xs text-center text-on-surface-variant">
              Answer all {progress.total} questions to submit ({progress.answered} done)
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
    <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-on-surface">
          {number}. {question.text}
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
                className={`min-w-[48px] flex-1 px-3 py-4 border-2 rounded-xl text-center transition-colors ${
                  answer?.rating === num
                    ? 'border-primary bg-primary/10 dark:bg-primary/15 text-primary'
                    : 'border-outline-variant dark:border-white/10 text-on-surface-variant hover:border-primary/40 hover:bg-primary/5'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="block text-lg font-semibold">{num}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant px-1">
            <span>{ratingScale.labels[0]?.title ?? 'Poor'}</span>
            <span>{ratingScale.labels[ratingScale.maxRating - 1]?.title ?? 'Excellent'}</span>
          </div>
          <details className="text-xs text-on-surface-variant">
            <summary className="cursor-pointer hover:text-on-surface select-none">View scale definitions</summary>
            <div className="mt-2 space-y-1 bg-surface-container-low dark:bg-[#1a2440] rounded-xl p-3">
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
            className="w-full px-4 py-3 border border-outline-variant dark:border-white/10 bg-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm text-on-surface placeholder:text-on-surface-variant/50 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter your response..."
          />
          {question.maxChars && (
            <div className="text-right text-xs text-on-surface-variant mt-1">
              {answer?.textAnswer?.length || 0} / {question.maxChars}
            </div>
          )}
        </div>
      )}

      {question.type === 'TASK_LIST' && (
        <TaskListInput
          value={answer?.textAnswer || ''}
          onChange={(value) => onUpdate(question.id, { textAnswer: value })}
          predefinedTasks={question.tasks || null}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function TaskListInput({
  value,
  onChange,
  predefinedTasks,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  predefinedTasks: Array<{ id: string; label: string; description?: string; required: boolean }> | null;
  disabled: boolean;
}) {
  if (predefinedTasks && predefinedTasks.length > 0) {
    const saved: Array<{ id: string; label: string; completed: boolean }> = value
      ? (() => { try { return JSON.parse(value).tasks || []; } catch { return []; } })()
      : [];
    const savedMap = new Map(saved.map((t) => [t.id, t.completed]));
    const taskState = predefinedTasks.map((t) => ({
      id: t.id, label: t.label, description: t.description,
      completed: savedMap.get(t.id) ?? false,
    }));
    const toggle = (id: string, completed: boolean) => {
      const updated = taskState.map((t) => (t.id === id ? { ...t, completed } : t));
      onChange(JSON.stringify({ tasks: updated }));
    };
    const completedCount = taskState.filter((t) => t.completed).length;
    return (
      <div className="space-y-2">
        {taskState.map((task) => (
          <label
            key={task.id}
            className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${!disabled ? 'cursor-pointer hover:bg-surface-container-low dark:hover:bg-[#1a2440]' : ''}`}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(e) => toggle(task.id, e.target.checked)}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 border-outline rounded disabled:opacity-50"
            />
            <div>
              <span className={`text-sm font-medium ${task.completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                {task.label}
              </span>
              {task.description && <p className="text-xs text-on-surface-variant mt-0.5">{task.description}</p>}
            </div>
          </label>
        ))}
        <p className="text-xs text-on-surface-variant pt-1">{completedCount} / {taskState.length} completed</p>
      </div>
    );
  }

  const tasks = value
    ? (() => { try { return JSON.parse(value).tasks; } catch { return [{ text: '', completed: false }]; } })()
    : [{ text: '', completed: false }];
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
            className="h-5 w-5 border-outline rounded mt-2"
          />
          <input
            type="text"
            value={task.text}
            onChange={(e) => updateTask(idx, { text: e.target.value })}
            disabled={disabled}
            placeholder="Enter task..."
            className="flex-1 px-3 py-2 border border-outline-variant dark:border-white/10 bg-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!disabled && tasks.length > 1 && (
            <button type="button" onClick={() => removeTask(idx)}
              className="text-on-surface-variant hover:text-error text-xl px-2">×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={addTask}
          className="text-sm text-primary hover:text-primary-dim font-medium">
          + Add task
        </button>
      )}
    </div>
  );
}
