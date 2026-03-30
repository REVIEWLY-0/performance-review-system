'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  reviewCyclesApi,
  ReviewCycle,
  ReviewCycleStatus,
} from '@/lib/review-cycles';
import ReviewCycleList from '@/components/review-cycles/ReviewCycleList';

export default function ReviewCyclesPage() {
  const router = useRouter();
  const [allCycles, setAllCycles] = useState<ReviewCycle[]>([]);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedTab, setSelectedTab] = useState<ReviewCycleStatus>('DRAFT');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialized = useRef(false);
  // Load all cycles once on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadCycles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter cycles locally when tab changes
  useEffect(() => {
    const filtered = allCycles.filter((c) => c.status === selectedTab);
    setCycles(filtered);
  }, [selectedTab, allCycles]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await reviewCyclesApi.getAll(); // Fetch all cycles without status filter
      setAllCycles(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load review cycles');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { value: ReviewCycleStatus; label: string }[] = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="inline-flex items-center text-sm text-on-surface-variant hover:text-on-surface mb-4"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Review Cycles</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Configure and manage performance review cycles
            </p>
          </div>
          <Link
            href="/admin/review-cycles/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dim"
          >
            + New Review Cycle
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-outline-variant mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(tab.value)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  selectedTab === tab.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }
              `}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    selectedTab === tab.value
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-surface-container'
                  }`}
                >
                  {allCycles.filter((c) => c.status === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Alert */}
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
            <button
              onClick={() => setError('')}
              className="ml-auto flex-shrink-0"
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

      {/* List */}
      <ReviewCycleList
        cycles={cycles}
        loading={loading}
        onRefresh={loadCycles}
      />
    </div>
  );
}
