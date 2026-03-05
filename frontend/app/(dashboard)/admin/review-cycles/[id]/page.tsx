'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  reviewCyclesApi,
  ReviewCycle,
  UpdateReviewCycleDto,
  ReviewConfig,
  CycleInsights,
} from '@/lib/review-cycles';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCycle();
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
            <p className="mt-4 text-gray-600">Loading review cycle...</p>
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
          className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
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
    return <CycleInsightsPanel cycleId={params.id} insights={insights} />;
  }

  // DRAFT — edit form
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <button
          onClick={() => router.push('/admin')}
          className="hover:text-indigo-600 transition-colors"
        >
          Dashboard
        </button>
        <span className="text-gray-300">/</span>
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="hover:text-indigo-600 transition-colors"
        >
          Review Cycles
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">Edit</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Review Cycle</h1>
        <p className="mt-1 text-sm text-gray-600">
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
