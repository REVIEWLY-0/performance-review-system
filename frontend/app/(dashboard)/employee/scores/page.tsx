'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { calculateScore, FinalScore } from '@/lib/scoring';

export default function EmployeeScoresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleParam = searchParams.get('cycleId');

  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    cycleParam || '',
  );
  const [scoreData, setScoreData] = useState<FinalScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCycleId && user) {
      loadScore();
    }
  }, [selectedCycleId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: allCycles } = await reviewCyclesApi.getAll();
      setCycles(allCycles);

      if (cycleParam && allCycles.find((c) => c.id === cycleParam)) {
        setSelectedCycleId(cycleParam);
      } else if (allCycles.length > 0 && !selectedCycleId) {
        setSelectedCycleId(allCycles[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadScore = async () => {
    if (!selectedCycleId || !user) return;

    try {
      setCalculating(true);
      setError('');
      const score = await calculateScore(selectedCycleId, user.id);
      setScoreData(score);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate score');
      setScoreData(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    router.push(`/employee/scores?cycleId=${cycleId}`);
  };

  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400 text-3xl">
            ⭐
          </span>
        ))}
        {hasHalfStar && <span className="text-yellow-400 text-3xl">⭐</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300 text-3xl">
            ☆
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-28 mb-4" />
          <div className="h-7 bg-gray-200 rounded w-48 mb-1" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-28 mb-2" />
          <div className="h-10 bg-gray-200 rounded w-80" />
        </div>
        <div className="animate-pulse space-y-4">
          <div className="bg-white shadow rounded-lg h-36" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white shadow rounded-lg h-24" />
            <div className="bg-white shadow rounded-lg h-24" />
            <div className="bg-white shadow rounded-lg h-24" />
          </div>
          <div className="bg-white shadow rounded-lg h-48" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="px-4 py-6 sm:px-0 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/employee')}
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">My Performance Scores</h1>
        <p className="mt-1 text-sm text-gray-600">
          View your performance review scores and feedback
        </p>
      </div>

      {/* Cycle Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Review Cycle
        </label>
        {cycles.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-700">
              No review cycles found.
            </p>
          </div>
        ) : (
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="block w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name} (
                {new Date(cycle.startDate).toLocaleDateString()} -{' '}
                {new Date(cycle.endDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {calculating && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Calculating scores...</p>
          </div>
        </div>
      )}

      {/* Score Display */}
      {!calculating && scoreData && (
        <div className="space-y-6">
          {/* Warnings */}
          {scoreData.warnings.length > 0 && (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  {scoreData.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm text-yellow-700">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Overall Score Card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-xl p-8 text-white">
            <h2 className="text-lg font-medium mb-4">Overall Score</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-6xl font-bold">
                  {scoreData.overall_score?.toFixed(2) || 'N/A'}
                  <span className="text-3xl text-indigo-200"> / 5.0</span>
                </div>
                {scoreData.overall_score && renderStars(scoreData.overall_score)}
              </div>
              <div className="text-right">
                <p className="text-sm text-indigo-200">Based on:</p>
                <p className="text-lg">
                  {scoreData.review_counts.self_reviews} Self
                </p>
                <p className="text-lg">
                  {scoreData.review_counts.manager_reviews} Manager
                  {scoreData.review_counts.manager_reviews !== 1 ? 's' : ''}
                </p>
                <p className="text-lg">
                  {scoreData.review_counts.peer_reviews} Peer
                  {scoreData.review_counts.peer_reviews !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Self Score */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Self Review
                </h3>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 text-xl">👤</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {scoreData.breakdown.self?.toFixed(2) || 'N/A'}
              </p>
              <p className="text-sm text-gray-500 mt-1">out of 5.0</p>
            </div>

            {/* Manager Score */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Manager Average
                </h3>
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 text-xl">👔</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {scoreData.breakdown.manager?.toFixed(2) || 'N/A'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {scoreData.review_counts.manager_reviews} review
                {scoreData.review_counts.manager_reviews !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Peer Score */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Peer Average
                </h3>
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 text-xl">👥</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {scoreData.breakdown.peer?.toFixed(2) || 'N/A'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {scoreData.review_counts.peer_reviews} review
                {scoreData.review_counts.peer_reviews !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Per-Question Breakdown */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Question-by-Question Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Question
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Self
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Manager Avg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peer Avg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overall
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scoreData.by_question.map((q, idx) => (
                    <tr key={q.questionId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {idx + 1}. {q.questionText}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {q.selfScore?.toFixed(1) || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {q.managerAvg?.toFixed(2) || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {q.peerAvg?.toFixed(2) || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {q.overallAvg?.toFixed(2) || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No Score Available */}
      {!calculating && !scoreData && !error && selectedCycleId && (
        <div className="bg-white shadow sm:rounded-lg p-12 text-center">
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0h2a2 2 0 002-2v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No scores available
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Complete your reviews to see your performance scores.
          </p>
        </div>
      )}
    </div>
  );
}
