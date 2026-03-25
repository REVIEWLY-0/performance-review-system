'use client';

import { Question, ReviewType } from '@/lib/questions';
import { RatingScale } from '@/lib/rating-scale';

interface QuestionPreviewProps {
  questions: Question[];
  reviewType: ReviewType;
  ratingScale?: RatingScale;
}

export default function QuestionPreview({ questions, reviewType, ratingScale }: QuestionPreviewProps) {
  const maxRating = ratingScale?.maxRating ?? 5;
  const getReviewTypeLabel = (type: ReviewType) => {
    switch (type) {
      case 'SELF':
        return 'Self Review';
      case 'MANAGER':
        return 'Manager Review';
      case 'PEER':
        return 'Peer Review';
      default:
        return type;
    }
  };

  if (questions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-on-surface-variant"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-on-surface">No preview available</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Create some questions to see how they&apos;ll appear to reviewers.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow sticky top-4">
      <div className="px-4 py-5 sm:p-6">
        <div className="mb-6">
          <h3 className="text-base font-semibold text-on-surface mb-1">Preview Mode</h3>
          <p className="text-sm text-on-surface-variant">
            This is how reviewers will see the {getReviewTypeLabel(reviewType).toLowerCase()}
          </p>
        </div>

        {/* Mock Review Form Header */}
        <div className="mb-6 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-surface-container-high"></div>
            <div>
              <p className="text-sm font-medium text-on-surface">John Doe</p>
              <p className="text-xs text-on-surface-variant">{getReviewTypeLabel(reviewType)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Draft
            </span>
            <span className="text-xs text-on-surface-variant">
              {questions.length} {questions.length === 1 ? 'question' : 'questions'}
            </span>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6 max-h-[600px] overflow-y-auto">
          {questions.map((question, index) => (
            <div key={question.id} className="pb-6 border-b border-outline-variant last:border-b-0">
              <div className="mb-3">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {index + 1}. {question.text}
                  {question.type !== 'RATING' && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {question.maxChars && (
                  <p className="text-xs text-on-surface-variant">
                    Maximum {question.maxChars} characters
                  </p>
                )}
              </div>

              {/* Rating Scale */}
              {question.type === 'RATING' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: maxRating }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        type="button"
                        className="flex-1 min-w-[2.5rem] px-3 py-3 border-2 border-outline rounded-lg text-center hover:border-primary hover:bg-indigo-50 transition-colors"
                      >
                        <span className="block text-lg font-semibold text-on-surface">
                          {num}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant px-1">
                    <span>{ratingScale?.labels[0]?.title ?? 'Poor'}</span>
                    <span>{ratingScale?.labels[maxRating - 1]?.title ?? 'Excellent'}</span>
                  </div>
                </div>
              )}

              {/* Text Response */}
              {question.type === 'TEXT' && (
                <textarea
                  rows={4}
                  placeholder="Type your response here..."
                  maxLength={question.maxChars || undefined}
                  className="w-full px-3 py-2 border border-outline rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              )}

              {/* Task List */}
              {question.type === 'TASK_LIST' && (
                <div className="space-y-2">
                  {question.tasks && question.tasks.length > 0 ? (
                    // Predefined tasks
                    question.tasks.map((task) => (
                      <label key={task.id} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-primary focus:ring-primary border-outline rounded"
                        />
                        <div>
                          <span className="text-sm text-on-surface">{task.label}</span>
                          {task.required && <span className="ml-1 text-xs text-red-500">*</span>}
                          {task.description && (
                            <p className="text-xs text-on-surface-variant">{task.description}</p>
                          )}
                        </div>
                      </label>
                    ))
                  ) : (
                    // Free-form fallback
                    <>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-primary focus:ring-primary border-outline rounded"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Add a task or goal..."
                            className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>
                      <button type="button" className="text-sm text-primary hover:text-primary font-medium">
                        + Add another item
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mock Actions */}
        <div className="mt-6 pt-6 border-t border-outline-variant flex justify-between">
          <button
            type="button"
            className="px-4 py-2 border border-outline rounded-md text-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low"
          >
            Save as Draft
          </button>
          <button
            type="button"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dim"
          >
            Submit Review
          </button>
        </div>

        {/* Preview Note */}
        <div className="mt-4 p-3 bg-surface-container-low rounded-lg">
          <p className="text-xs text-on-surface-variant">
            📋 This is a preview. Actual reviews may include additional fields like
            reviewer name, date, and progress indicators.
          </p>
        </div>
      </div>
    </div>
  );
}
