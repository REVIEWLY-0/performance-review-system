'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getSelfReview,
  saveDraft,
  submitReview,
  SelfReviewData,
  QuestionWithAnswer,
  Answer,
  TaskDefinition,
} from '@/lib/reviews';

// Free-form task item (employee-defined, no predefined tasks)
interface TaskItem {
  text: string;
  completed: boolean;
}

// Predefined task state (admin-defined)
interface PredefinedTaskState {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
}

export default function SelfReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get('cycleId');

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reviewData, setReviewData] = useState<SelfReviewData | null>(null);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [dirtyAnswers, setDirtyAnswers] = useState<Set<string>>(new Set());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save timer ref
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load review data on mount
  useEffect(() => {
    if (!cycleId) {
      setError('Review cycle ID is required');
      setLoading(false);
      return;
    }

    loadReview();
  }, [cycleId]);

  const loadReview = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSelfReview(cycleId!);
      setReviewData(data);

      // Initialize answers from existing data
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
    } catch (err: any) {
      console.error('Error loading review:', err);
      setError(err.message || 'Failed to load review');
    } finally {
      setLoading(false);
    }
  };

  // Setup auto-save on interval
  useEffect(() => {
    if (!reviewData || reviewData.review.status === 'SUBMITTED') return;

    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // Only auto-save if there are dirty answers
    if (dirtyAnswers.size > 0) {
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave();
      }, 30000); // 30 seconds
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [dirtyAnswers, reviewData]);

  const handleAutoSave = async () => {
    if (!cycleId || dirtyAnswers.size === 0) return;

    try {
      setSaving(true);

      // Get only dirty answers
      const answersToSave = Array.from(dirtyAnswers)
        .map((qId) => answers.get(qId))
        .filter((a): a is Answer => a !== undefined);

      const result = await saveDraft(cycleId, answersToSave);
      setLastSaved(new Date(result.updatedAt));
      setDirtyAnswers(new Set()); // Clear dirty flags

      console.log('✓ Auto-saved draft');
    } catch (err: any) {
      console.error('Auto-save failed:', err);
      // Don't show error to user for auto-save failures
    } finally {
      setSaving(false);
    }
  };

  const updateAnswer = (questionId: string, updates: Partial<Answer>) => {
    setAnswers((prev) => {
      const current = prev.get(questionId) || { questionId };
      const updated = { ...current, ...updates };
      const newMap = new Map(prev);
      newMap.set(questionId, updated);
      return newMap;
    });

    setDirtyAnswers((prev) => new Set(prev).add(questionId));
  };

  const handleRatingChange = (questionId: string, rating: number) => {
    updateAnswer(questionId, { rating });
  };

  const handleTextChange = (questionId: string, textAnswer: string) => {
    updateAnswer(questionId, { textAnswer });
  };

  const handleTaskListChange = (questionId: string, tasks: TaskItem[]) => {
    const textAnswer = JSON.stringify({ tasks });
    updateAnswer(questionId, { textAnswer });
  };

  const handlePredefinedTaskChange = (questionId: string, tasks: PredefinedTaskState[]) => {
    const textAnswer = JSON.stringify({ tasks });
    updateAnswer(questionId, { textAnswer });
  };

  // Calculate progress
  const calculateProgress = useCallback(() => {
    if (!reviewData) return { answered: 0, total: 0, percentage: 0 };

    const total = reviewData.questions.length;
    let answered = 0;

    reviewData.questions.forEach((q) => {
      const answer = answers.get(q.id);
      if (!answer) return;

      const isAnswered =
        (q.type === 'RATING' && typeof answer.rating === 'number' && answer.rating > 0) ||
        (q.type === 'TEXT' &&
          typeof answer.textAnswer === 'string' &&
          answer.textAnswer.trim().length > 0) ||
        (q.type === 'TASK_LIST' &&
          typeof answer.textAnswer === 'string' &&
          (() => {
            try {
              const parsed = JSON.parse(answer.textAnswer!);
              const tasks = parsed.tasks || [];
              // For predefined tasks: at least one checked
              // For free-form tasks: at least one item exists
              if (tasks.length === 0) return false;
              if ('id' in tasks[0]) return tasks.some((t: any) => t.completed);
              return tasks.length > 0;
            } catch { return false; }
          })());

      if (isAnswered) answered++;
    });

    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [reviewData, answers]);

  const handleSubmit = async () => {
    if (!cycleId || !reviewData) return;

    const progress = calculateProgress();
    if (progress.answered < progress.total) {
      setError(
        `Please answer all ${progress.total} questions before submitting (${progress.answered} answered)`,
      );
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const allAnswers = Array.from(answers.values());
      await submitReview(cycleId, allAnswers);

      // Redirect to dashboard with success message
      router.push('/employee?message=Review submitted successfully');
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-7 bg-gray-200 rounded w-40 mb-1" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="mb-6 bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-6 bg-gray-200 rounded w-12" />
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5" />
        </div>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex-1 h-16 bg-gray-200 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-red-700">{error || 'Failed to load review'}</p>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const isSubmitted = reviewData.review.status === 'SUBMITTED';

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/employee')}
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Self Review</h1>
        <p className="mt-1 text-sm text-gray-600">
          Complete your self-assessment for this review cycle
        </p>
      </div>

      {/* Status Banner */}
      {isSubmitted && (
        <div className="mb-6 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                This review has been submitted and cannot be modified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
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
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError('')}
                className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Card */}
      {!isSubmitted && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Progress: {progress.answered} / {progress.total} questions
              </p>
              {lastSaved && (
                <p className="text-xs text-gray-500 mt-1">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </div>
            <span className="text-2xl font-bold text-indigo-600">
              {progress.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {reviewData.questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            answer={answers.get(question.id)}
            onRatingChange={handleRatingChange}
            onTextChange={handleTextChange}
            onTaskListChange={handleTaskListChange}
            onPredefinedTaskChange={handlePredefinedTaskChange}
            disabled={isSubmitted}
          />
        ))}
      </div>

      {/* Actions */}
      {!isSubmitted && (
        <div className="mt-8 flex justify-between items-center bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">
            {saving && (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                Saving draft...
              </span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || saving}
            className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Question Card Component
// ============================================================================

interface QuestionCardProps {
  question: QuestionWithAnswer;
  index: number;
  answer?: Answer;
  onRatingChange: (questionId: string, rating: number) => void;
  onTextChange: (questionId: string, text: string) => void;
  onTaskListChange: (questionId: string, tasks: TaskItem[]) => void;
  onPredefinedTaskChange: (questionId: string, tasks: PredefinedTaskState[]) => void;
  disabled: boolean;
}

function QuestionCard({
  question,
  index,
  answer,
  onRatingChange,
  onTextChange,
  onTaskListChange,
  onPredefinedTaskChange,
  disabled,
}: QuestionCardProps) {
  const hasPredefined = question.tasks && question.tasks.length > 0;

  // Predefined task state (initialized from saved answer or question definition)
  const [predefinedTasks, setPredefinedTasks] = useState<PredefinedTaskState[]>(() => {
    if (!hasPredefined) return [];
    if (answer?.textAnswer) {
      try {
        const saved = JSON.parse(answer.textAnswer).tasks as PredefinedTaskState[];
        // Merge saved completion state with current definition (in case tasks changed)
        const savedMap = new Map(saved.map((t) => [t.id, t.completed]));
        return question.tasks!.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description,
          completed: savedMap.get(t.id) ?? false,
        }));
      } catch {
        // fall through to default
      }
    }
    return question.tasks!.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      completed: false,
    }));
  });

  // Free-form task state
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (hasPredefined) return [];
    if (question.type === 'TASK_LIST' && answer?.textAnswer) {
      try {
        return JSON.parse(answer.textAnswer).tasks || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handlePredefinedToggle = (taskId: string, completed: boolean) => {
    const updated = predefinedTasks.map((t) =>
      t.id === taskId ? { ...t, completed } : t,
    );
    setPredefinedTasks(updated);
    onPredefinedTaskChange(question.id, updated);
  };

  const handleTaskUpdate = (newTasks: TaskItem[]) => {
    setTasks(newTasks);
    onTaskListChange(question.id, newTasks);
  };

  const addTask = () => {
    handleTaskUpdate([...tasks, { text: '', completed: false }]);
  };

  const removeTask = (taskIndex: number) => {
    handleTaskUpdate(tasks.filter((_, i) => i !== taskIndex));
  };

  const updateTask = (taskIndex: number, updates: Partial<TaskItem>) => {
    handleTaskUpdate(tasks.map((task, i) => (i === taskIndex ? { ...task, ...updates } : task)));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <label className="block text-base font-medium text-gray-900 mb-1">
          {index + 1}. {question.text}
          <span className="text-red-500 ml-1">*</span>
        </label>
        {question.maxChars && (
          <p className="text-sm text-gray-500">Maximum {question.maxChars} characters</p>
        )}
      </div>

      {/* Rating Question */}
      {question.type === 'RATING' && (
        <div className="space-y-3">
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onRatingChange(question.id, num)}
                disabled={disabled}
                className={`flex-1 px-4 py-4 border-2 rounded-lg text-center transition-colors ${
                  answer?.rating === num
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="block text-xl font-semibold text-gray-900">{num}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-500 px-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      )}

      {/* Text Question */}
      {question.type === 'TEXT' && (
        <div>
          <textarea
            value={answer?.textAnswer || ''}
            onChange={(e) => onTextChange(question.id, e.target.value)}
            disabled={disabled}
            rows={5}
            maxLength={question.maxChars || undefined}
            placeholder="Type your response here..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {question.maxChars && (
            <div className="mt-2 text-right text-sm text-gray-500">
              {answer?.textAnswer?.length || 0} / {question.maxChars}
            </div>
          )}
        </div>
      )}

      {/* Task List — predefined tasks */}
      {question.type === 'TASK_LIST' && hasPredefined && (
        <div className="space-y-2">
          {predefinedTasks.map((task) => (
            <label key={task.id} className={`flex items-start gap-3 p-2 rounded-md transition-colors ${!disabled ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => handlePredefinedToggle(task.id, e.target.checked)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
              />
              <div>
                <span className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {task.label}
                </span>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                )}
              </div>
            </label>
          ))}
          <p className="text-xs text-gray-400 pt-1">
            {predefinedTasks.filter((t) => t.completed).length} / {predefinedTasks.length} completed
          </p>
        </div>
      )}

      {/* Task List — free-form (no predefined tasks) */}
      {question.type === 'TASK_LIST' && !hasPredefined && (
        <div className="space-y-3">
          {tasks.map((task, taskIndex) => (
            <div key={taskIndex} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => updateTask(taskIndex, { completed: e.target.checked })}
                disabled={disabled}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
              />
              <input
                type="text"
                value={task.text}
                onChange={(e) => updateTask(taskIndex, { text: e.target.value })}
                disabled={disabled}
                placeholder="Add a task or goal..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTask(taskIndex)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={addTask}
              className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
            >
              + Add another item
            </button>
          )}
        </div>
      )}
    </div>
  );
}
