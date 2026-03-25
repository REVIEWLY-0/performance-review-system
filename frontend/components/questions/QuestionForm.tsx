'use client';

import { useState, useEffect } from 'react';
import { Question, QuestionType, ReviewType, CreateQuestionDto, TaskDefinition } from '@/lib/questions';
import { RatingScale } from '@/lib/rating-scale';

interface QuestionFormProps {
  reviewType: ReviewType;
  question?: Question | null;
  ratingScale?: RatingScale;
  onSubmit: (dto: CreateQuestionDto) => Promise<void>;
  onCancel: () => void;
}

// Generate a simple local ID for new task items
function newTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function QuestionForm({
  reviewType,
  question,
  ratingScale,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  const maxRating = ratingScale?.maxRating ?? 5;
  const [formData, setFormData] = useState<CreateQuestionDto>({
    reviewType,
    type: 'RATING',
    text: '',
    maxChars: undefined,
    tasks: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (question) {
      setFormData({
        reviewType: question.reviewType,
        type: question.type,
        text: question.text,
        maxChars: question.maxChars || undefined,
        tasks: question.tasks ? [...question.tasks] : [],
      });
    } else {
      setFormData({
        reviewType,
        type: 'RATING',
        text: '',
        maxChars: undefined,
        tasks: [],
      });
    }
  }, [question, reviewType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.text.trim()) {
      setError('Question text is required');
      return;
    }

    if (formData.type === 'TEXT' && formData.maxChars && formData.maxChars < 10) {
      setError('Max characters must be at least 10');
      return;
    }

    // Clean up empty task labels before saving
    const cleanedTasks = (formData.tasks || []).filter((t) => t.label.trim().length > 0);

    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        tasks: formData.type === 'TASK_LIST' ? cleanedTasks : undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setLoading(false);
    }
  };

  // ── Task helpers ────────────────────────────────────────────────────────────

  const tasks = formData.tasks || [];

  const addTask = () => {
    setFormData((prev) => ({
      ...prev,
      tasks: [...(prev.tasks || []), { id: newTaskId(), label: '', required: false }],
    }));
  };

  const updateTask = (index: number, updates: Partial<TaskDefinition>) => {
    setFormData((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((t, i) => (i === index ? { ...t, ...updates } : t)),
    }));
  };

  const removeTask = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((_, i) => i !== index),
    }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const questionTypes: { value: QuestionType; label: string; description: string }[] = [
    { value: 'RATING', label: 'Rating Scale', description: `Employees rate from 1–${maxRating}` },
    { value: 'TEXT', label: 'Text Response', description: 'Free-form text answer' },
    { value: 'TASK_LIST', label: 'Task List', description: 'Predefined tasks employees mark complete' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {question ? 'Edit Question' : 'New Question'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Create a question for {reviewType.toLowerCase().replace('_', ' ')} reviews
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Question Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question Type
          </label>
          <div className="space-y-3">
            {questionTypes.map((type) => (
              <div key={type.value} className="flex items-start">
                <input
                  type="radio"
                  id={`type-${type.value}`}
                  name="type"
                  value={type.value}
                  checked={formData.type === type.value}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as QuestionType })
                  }
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor={`type-${type.value}`} className="ml-3 flex-1 cursor-pointer">
                  <span className="block text-sm font-medium text-gray-700">{type.label}</span>
                  <span className="block text-sm text-gray-500">{type.description}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Question Text */}
        <div>
          <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
            Question Text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="text"
            rows={4}
            value={formData.text}
            onChange={(e) => setFormData({ ...formData, text: e.target.value })}
            placeholder="Enter your question here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Be clear and specific. This is what reviewers will see.
          </p>
        </div>

        {/* Max Characters (TEXT type) */}
        {formData.type === 'TEXT' && (
          <div>
            <label htmlFor="maxChars" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Characters (Optional)
            </label>
            <input
              type="number"
              id="maxChars"
              min="10"
              max="5000"
              value={formData.maxChars || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxChars: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="e.g., 500"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Leave empty for no limit. Recommended: 200–500 characters.
            </p>
          </div>
        )}

        {/* Task Items (TASK_LIST type) */}
        {formData.type === 'TASK_LIST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Items
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Define the tasks employees will mark as complete. Leave empty to let employees add their own.
            </p>

            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div key={task.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={task.label}
                      onChange={(e) => updateTask(index, { label: e.target.value })}
                      placeholder="Task label (e.g., Complete code review)"
                      maxLength={500}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={task.description || ''}
                      onChange={(e) =>
                        updateTask(index, { description: e.target.value || undefined })
                      }
                      placeholder="Description (optional)"
                      maxLength={500}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.required}
                        onChange={(e) => updateTask(index, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remove task"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addTask}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add task item
            </button>

            {/* Inline preview */}
            {tasks.filter((t) => t.label.trim()).length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
                <p className="text-sm text-gray-900 mb-2">{formData.text || 'Your question...'}</p>
                <div className="space-y-1.5">
                  {tasks.filter((t) => t.label.trim()).map((task) => (
                    <label key={task.id} className="flex items-start gap-2">
                      <input type="checkbox" disabled className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                      <div>
                        <span className="text-sm text-gray-700">{task.label}</span>
                        {task.required && (
                          <span className="ml-1 text-xs text-red-500">*</span>
                        )}
                        {task.description && (
                          <p className="text-xs text-gray-500">{task.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview (RATING / TEXT) */}
        {formData.type !== 'TASK_LIST' && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-900 mb-3">
                {formData.text || 'Your question will appear here...'}
              </p>
              {formData.type === 'RATING' && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: maxRating }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>{ratingScale?.labels[0]?.title ?? 'Poor'}</span>
                    <span>{ratingScale?.labels[maxRating - 1]?.title ?? 'Excellent'}</span>
                  </div>
                </div>
              )}
              {formData.type === 'TEXT' && (
                <div>
                  <textarea
                    rows={3}
                    placeholder="Reviewer's answer will go here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled
                  />
                  {formData.maxChars && (
                    <p className="mt-1 text-xs text-gray-500">
                      Max {formData.maxChars} characters
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : question ? 'Update Question' : 'Create Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
