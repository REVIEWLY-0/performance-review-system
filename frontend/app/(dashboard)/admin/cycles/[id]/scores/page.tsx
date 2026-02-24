'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { calculateAllScores, AllScoresResponse } from '@/lib/scoring';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonTable from '@/components/skeletons/SkeletonTable';

interface ScoresPageProps {
  params: {
    id: string;
  };
}

export default function CycleScoresPage({ params }: ScoresPageProps) {
  const router = useRouter();
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [scoresData, setScoresData] = useState<AllScoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const cycleData = await reviewCyclesApi.getOne(params.id);
      setCycle(cycleData);
    } catch (err: any) {
      setError(err.message || 'Failed to load cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    try {
      setCalculating(true);
      setError('');
      const scores = await calculateAllScores(params.id);
      setScoresData(scores);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate scores');
    } finally {
      setCalculating(false);
    }
  };

  const exportToCSV = () => {
    if (!scoresData) return;

    const headers = [
      'Employee Name',
      'Overall Score',
      'Self Score',
      'Manager Avg',
      'Peer Avg',
      'Self Reviews',
      'Manager Reviews',
      'Peer Reviews',
    ];

    const rows = scoresData.scores.map((score) => [
      score.employeeName,
      score.overall_score?.toFixed(2) || 'N/A',
      score.breakdown.self?.toFixed(2) || 'N/A',
      score.breakdown.manager?.toFixed(2) || 'N/A',
      score.breakdown.peer?.toFixed(2) || 'N/A',
      score.review_counts.self_reviews,
      score.review_counts.manager_reviews,
      score.review_counts.peer_reviews,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cycle?.name || 'scores'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-7 bg-gray-200 rounded w-72 mb-1" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Cycle not found'}</p>
        </div>
      </div>
    );
  }

  const averageScore =
    scoresData && scoresData.scores.length > 0
      ? scoresData.scores
          .filter((s) => s.overall_score !== null)
          .reduce((sum, s) => sum + (s.overall_score || 0), 0) /
        scoresData.scores.filter((s) => s.overall_score !== null).length
      : null;

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-2"
        >
          ← Back to Review Cycles
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Performance Scores: {cycle.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          View and export performance scores for all employees
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={handleCalculateAll}
          disabled={calculating}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calculating ? 'Calculating...' : 'Calculate All Scores'}
        </button>
        {scoresData && (
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            📥 Export to CSV
          </button>
        )}
      </div>

      {/* Calculating State */}
      {calculating && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">
              Calculating scores for all employees...
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {scoresData && !calculating && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {scoresData.scores.length}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm font-medium text-gray-500">Average Score</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {averageScore?.toFixed(2) || 'N/A'}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm font-medium text-gray-500">
              Scores Calculated
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {scoresData.scores.filter((s) => s.overall_score !== null).length}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm font-medium text-gray-500">
              Pending Reviews
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {scoresData.scores.filter((s) => s.overall_score === null).length}
            </p>
          </div>
        </div>
      )}

      {/* Scores Table */}
      {scoresData && !calculating && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Self
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviews
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scoresData.scores.map((score) => (
                  <tr key={score.employeeId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {score.employeeName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {score.overall_score?.toFixed(2) || (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {score.breakdown.self?.toFixed(2) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {score.breakdown.manager?.toFixed(2) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {score.breakdown.peer?.toFixed(2) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex gap-2">
                        <span title="Self">
                          {score.review_counts.self_reviews}S
                        </span>
                        <span title="Manager">
                          {score.review_counts.manager_reviews}M
                        </span>
                        <span title="Peer">
                          {score.review_counts.peer_reviews}P
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() =>
                          router.push(
                            `/employee/scores?cycleId=${params.id}`,
                          )
                        }
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data */}
      {!scoresData && !calculating && (
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
            No scores calculated
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Click "Calculate All Scores" to generate performance scores for all
            employees.
          </p>
        </div>
      )}
    </div>
  );
}
