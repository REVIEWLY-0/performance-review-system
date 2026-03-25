'use client';

import { useState, useEffect } from 'react';
import { Question, ReviewType } from '@/lib/questions';

interface QuestionListProps {
  questions: Question[];
  reviewType: ReviewType;
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (reviewType: ReviewType, questionIds: string[]) => void;
}

export default function QuestionList({
  questions,
  reviewType,
  onEdit,
  onDelete,
  onDuplicate,
  onReorder,
}: QuestionListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions);

  // Sync local list when parent passes a new tab's questions or reloads after mutation
  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder locally
    const items = [...localQuestions];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    setLocalQuestions(items);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex === null) return;

    // Save the new order
    const questionIds = localQuestions.map((q) => q.id);
    onReorder(reviewType, questionIds);
    setDraggedIndex(null);
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'RATING':
        return 'Rating Scale';
      case 'TEXT':
        return 'Text Response';
      case 'TASK_LIST':
        return 'Task List';
      default:
        return type;
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'RATING':
        return 'bg-blue-100 text-blue-800';
      case 'TEXT':
        return 'bg-green-100 text-green-800';
      case 'TASK_LIST':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-surface-container text-on-surface';
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
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-on-surface">No questions yet</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Get started by creating a new question for this review type.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-on-surface">
            Questions ({questions.length})
          </h3>
          <p className="text-sm text-on-surface-variant">Drag to reorder</p>
        </div>

        <div className="space-y-3">
          {localQuestions.map((question, index) => (
            <div
              key={question.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                border rounded-lg p-4 cursor-move transition-all
                ${
                  draggedIndex === index
                    ? 'opacity-50 border-primary'
                    : 'border-outline-variant hover:border-outline'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div className="flex-shrink-0 mt-1 text-on-surface-variant">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>

                {/* Question Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQuestionTypeColor(
                        question.type,
                      )}`}
                    >
                      {getQuestionTypeLabel(question.type)}
                    </span>
                    <span className="text-xs text-on-surface-variant">#{index + 1}</span>
                  </div>

                  <p className="text-sm text-on-surface mb-3">{question.text}</p>

                  {question.maxChars && (
                    <p className="text-xs text-on-surface-variant mb-3">
                      Max {question.maxChars} characters
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(question)}
                      className="text-xs text-primary hover:text-primary font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-outline">|</span>
                    <button
                      onClick={() => onDuplicate(question.id)}
                      className="text-xs text-on-surface-variant hover:text-on-surface font-medium"
                    >
                      Duplicate
                    </button>
                    <span className="text-outline">|</span>
                    <button
                      onClick={() => onDelete(question.id)}
                      className="text-xs text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reorder Hint */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 Tip: Click and drag questions to reorder them. The order will be saved
            automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
