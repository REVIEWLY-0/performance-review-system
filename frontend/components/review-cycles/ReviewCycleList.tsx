'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReviewCycle, reviewCyclesApi, formatDate } from '@/lib/review-cycles';
import StatusBadge from './StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';

interface ReviewCycleListProps {
  cycles: ReviewCycle[];
  loading: boolean;
  onRefresh: () => void;
}

type ActionType = 'activate' | 'complete' | 'delete';

const DIALOG: Record<ActionType, { title: string; message: string; confirmLabel: string; variant: 'default' | 'danger' }> = {
  activate: {
    title: 'Activate review cycle',
    message: 'Once activated, employees will be notified and reviews can begin. You cannot revert this to draft.',
    confirmLabel: 'Activate',
    variant: 'default',
  },
  complete: {
    title: 'Complete review cycle',
    message: 'This will close all open reviews and trigger final score calculations.',
    confirmLabel: 'Complete',
    variant: 'default',
  },
  delete: {
    title: 'Delete review cycle',
    message: 'This action cannot be undone. All configuration and data for this cycle will be permanently lost.',
    confirmLabel: 'Delete',
    variant: 'danger',
  },
};

export default function ReviewCycleList({
  cycles,
  loading,
  onRefresh,
}: ReviewCycleListProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: ActionType; id: string } | null>(null);
  const toast = useToast();

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { type, id } = pendingAction;
    try {
      setActioningId(id);
      setError('');
      if (type === 'activate') {
        await reviewCyclesApi.activate(id);
        toast.success('Review cycle activated');
      } else if (type === 'complete') {
        await reviewCyclesApi.complete(id);
        toast.success('Review cycle completed');
      } else {
        await reviewCyclesApi.delete(id);
        toast.success('Review cycle deleted');
      }
      setPendingAction(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || `Failed to ${type} cycle`);
      setPendingAction(null);
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading review cycles...</p>
        </div>
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No review cycles
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new review cycle.
        </p>
      </div>
    );
  }

  return (
    <>
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
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="ml-3 flex-shrink-0"
            >
              <span className="sr-only">Dismiss</span>
              <svg
                className="h-5 w-5 text-red-400 hover:text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {cycles.map((cycle) => (
          <div
            key={cycle.id}
            className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {cycle.name}
                  </h3>
                  <StatusBadge status={cycle.status} />
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                  <span>
                    📅 {formatDate(cycle.startDate)} -{' '}
                    {formatDate(cycle.endDate)}
                  </span>
                  <span>
                    📊 {cycle.reviewConfigs.length} workflow step
                    {cycle.reviewConfigs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {/* Edit button - only for DRAFT */}
                {cycle.status === 'DRAFT' && (
                  <Link
                    href={`/admin/review-cycles/${cycle.id}`}
                    className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Edit
                  </Link>
                )}

                {/* View button - for ACTIVE and COMPLETED */}
                {(cycle.status === 'ACTIVE' || cycle.status === 'COMPLETED') && (
                  <Link
                    href={`/admin/review-cycles/${cycle.id}`}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    View
                  </Link>
                )}

                {/* Assign Reviewers button - available for DRAFT and ACTIVE */}
                {(cycle.status === 'DRAFT' || cycle.status === 'ACTIVE') && (
                  <Link
                    href={`/admin/review-cycles/${cycle.id}/assign-reviewers`}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Assign Reviewers
                  </Link>
                )}

                {/* Activate button - only for DRAFT */}
                {cycle.status === 'DRAFT' && (
                  <button
                    onClick={() => setPendingAction({ type: 'activate', id: cycle.id })}
                    disabled={actioningId === cycle.id}
                    className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {actioningId === cycle.id ? 'Activating...' : 'Activate'}
                  </button>
                )}

                {/* Complete button - only for ACTIVE */}
                {cycle.status === 'ACTIVE' && (
                  <button
                    onClick={() => setPendingAction({ type: 'complete', id: cycle.id })}
                    disabled={actioningId === cycle.id}
                    className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actioningId === cycle.id ? 'Completing...' : 'Complete'}
                  </button>
                )}

                {/* Delete button - only for DRAFT */}
                {cycle.status === 'DRAFT' && (
                  <button
                    onClick={() => setPendingAction({ type: 'delete', id: cycle.id })}
                    disabled={actioningId === cycle.id}
                    className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {actioningId === cycle.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingAction && (
        <ConfirmDialog
          {...DIALOG[pendingAction.type]}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}
