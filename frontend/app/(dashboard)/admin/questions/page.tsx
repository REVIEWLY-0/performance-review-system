'use client';

import { useEffect, useState } from 'react';
import {
  getGroupedQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  duplicateQuestion,
  Question,
  QuestionType,
  ReviewType,
  CreateQuestionDto,
} from '@/lib/questions';
import QuestionForm from '@/components/questions/QuestionForm';
import QuestionList from '@/components/questions/QuestionList';
import QuestionPreview from '@/components/questions/QuestionPreview';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import BackButton from '@/components/BackButton';

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<{
    SELF: Question[];
    MANAGER: Question[];
    PEER: Question[];
  }>({
    SELF: [],
    MANAGER: [],
    PEER: [],
  });

  const [selectedTab, setSelectedTab] = useState<ReviewType>('SELF');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await getGroupedQuestions();
      setQuestions(data);
    } catch (err: any) {
      console.error('Error loading questions:', err);
      setError(err.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (dto: CreateQuestionDto) => {
    try {
      await createQuestion(dto);
      await loadQuestions();
      setShowForm(false);
      setError('');
      toast.success('Question created');
    } catch (err: any) {
      setError(err.message || 'Failed to create question');
      throw err;
    }
  };

  const handleUpdateQuestion = async (id: string, dto: CreateQuestionDto) => {
    try {
      await updateQuestion(id, dto);
      await loadQuestions();
      setShowForm(false);
      setEditingQuestion(null);
      setError('');
      toast.success('Question updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update question');
      throw err;
    }
  };

  const handleDeleteQuestion = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteQuestion(confirmDeleteId);
      await loadQuestions();
      setConfirmDeleteId(null);
      toast.success('Question deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
      setConfirmDeleteId(null);
    }
  };

  const handleDuplicateQuestion = async (id: string) => {
    try {
      await duplicateQuestion(id);
      await loadQuestions();
      toast.success('Question duplicated');
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate question');
    }
  };

  const handleReorder = async (reviewType: ReviewType, questionIds: string[]) => {
    try {
      await reorderQuestions(reviewType, questionIds);
      // Optimistically update the local state
      setQuestions((prev) => ({
        ...prev,
        [reviewType]: questionIds
          .map((id) => prev[reviewType].find((q) => q.id === id))
          .filter((q): q is Question => q !== undefined),
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to reorder questions');
      // Reload to get the correct order from server
      await loadQuestions();
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingQuestion(null);
  };

  const tabs: { value: ReviewType; label: string; description: string }[] = [
    {
      value: 'SELF',
      label: 'Self Review',
      description: 'Questions employees answer about themselves',
    },
    {
      value: 'MANAGER',
      label: 'Manager Review',
      description: 'Questions managers answer about their reports',
    },
    {
      value: 'PEER',
      label: 'Peer Review',
      description: 'Questions peers answer about each other',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <BackButton href="/admin" label="Back to Admin Dashboard" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question Builder</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and manage questions for different review types
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button
              onClick={() => {
                setEditingQuestion(null);
                setShowForm(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              + New Question
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${
                  selectedTab === tab.value
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.label}</span>
              <span
                className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                  selectedTab === tab.value
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {questions[tab.value].length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Description */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          {tabs.find((t) => t.value === selectedTab)?.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <div>
          <QuestionList
            questions={questions[selectedTab]}
            reviewType={selectedTab}
            onEdit={handleEdit}
            onDelete={handleDeleteQuestion}
            onDuplicate={handleDuplicateQuestion}
            onReorder={handleReorder}
          />
        </div>

        {/* Form or Preview */}
        <div>
          {showForm ? (
            <QuestionForm
              reviewType={selectedTab}
              question={editingQuestion}
              onSubmit={
                editingQuestion
                  ? (dto) => handleUpdateQuestion(editingQuestion.id, dto)
                  : handleCreateQuestion
              }
              onCancel={handleCloseForm}
            />
          ) : showPreview ? (
            <QuestionPreview questions={questions[selectedTab]} reviewType={selectedTab} />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-4">
                Click &quot;New Question&quot; to create a question or &quot;Show Preview&quot; to preview how questions will appear
              </p>
            </div>
          )}
        </div>
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete question"
          message="This question will be permanently removed from this review type. This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
