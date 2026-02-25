'use client';

import { useRouter } from 'next/navigation';
import { reviewCyclesApi, CreateReviewCycleDto, UpdateReviewCycleDto } from '@/lib/review-cycles';
import ReviewCycleForm from '@/components/review-cycles/ReviewCycleForm';
import BackButton from '@/components/BackButton';

export default function NewReviewCyclePage() {
  const router = useRouter();

  const handleSubmit = async (data: CreateReviewCycleDto | UpdateReviewCycleDto) => {
    await reviewCyclesApi.create(data as CreateReviewCycleDto);
    router.push('/admin/review-cycles');
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <BackButton href="/admin" label="← Back to Dashboard" />
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Create Review Cycle</h1>
        </div>
        <p className="text-sm text-gray-500">
          <button
            onClick={() => router.push('/admin/review-cycles')}
            className="text-indigo-600 hover:underline"
          >
            Review Cycles
          </button>
          {' / New'}
        </p>
      </div>

      <ReviewCycleForm mode="create" onSubmit={handleSubmit} />
    </div>
  );
}
