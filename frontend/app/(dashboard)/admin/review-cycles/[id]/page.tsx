'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  reviewCyclesApi,
  ReviewCycle,
  UpdateReviewCycleDto,
  ReviewConfig,
  CycleInsights,
} from '@/lib/review-cycles';
import { invalidateCache } from '@/lib/cache';
import ReviewCycleForm from '@/components/review-cycles/ReviewCycleForm';
import CycleInsightsPanel from '@/components/review-cycles/CycleInsightsPanel';

export default function ReviewCycleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [insights, setInsights] = useState<CycleInsights | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCycle();
  }, [params.id]);

  const refreshInsights = useCallback(async () => {
    try {
      setRefreshing(true);
      invalidateCache('cycles:insights:');
      const insightsData = await reviewCyclesApi.getInsights(params.id);
      setInsights(insightsData);
    } catch (err: any) {
      console.error('Failed to refresh insights:', err);
    } finally {
      setRefreshing(false);
    }
  }, [params.id]);

  const loadCycle = async () => {
    try {
      setLoading(true);
      const data = await reviewCyclesApi.getOne(params.id);
      setCycle(data);

      // For non-DRAFT cycles load the insights panel data
      if (data.status !== 'DRAFT') {
        const insightsData = await reviewCyclesApi.getInsights(params.id);
        setInsights(insightsData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load review cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (
    data: UpdateReviewCycleDto,
    configs?: ReviewConfig[],
  ) => {
    await reviewCyclesApi.update(params.id, data);
    if (configs) {
      await reviewCyclesApi.updateConfigs(params.id, configs);
    }
    router.push('/admin/review-cycles');
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-on-surface-variant">Loading review cycle...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Review cycle not found'}</p>
        </div>
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="mt-4 text-sm text-primary hover:text-primary-dim"
        >
          ← Back to Review Cycles
        </button>
      </div>
    );
  }

  // ACTIVE / COMPLETED — show HR insights panel
  if (cycle.status !== 'DRAFT') {
    if (!insights) {
      return (
        <div className="px-4 py-6 sm:px-0 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      );
    }
    return (
      <div>
        <div className="flex justify-end px-4 pt-4 sm:px-0">
          <button
            onClick={refreshInsights}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-on-surface-variant hover:text-primary border border-outline-variant rounded-lg hover:border-primary transition-colors disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <CycleInsightsPanel cycleId={params.id} insights={insights!} />
      </div>
    );
  }

  // DRAFT — edit form
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
        <button
          onClick={() => router.push('/admin')}
          className="hover:text-primary transition-colors"
        >
          Dashboard
        </button>
        <span className="text-outline-variant">/</span>
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="hover:text-primary transition-colors"
        >
          Review Cycles
        </button>
        <span className="text-outline-variant">/</span>
        <span className="text-on-surface font-medium">Edit</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Edit Review Cycle</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Update the review cycle details and workflow configuration
        </p>
      </div>

      <ReviewCycleForm
        mode="edit"
        initialData={cycle}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
