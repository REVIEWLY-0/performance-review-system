'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getEmployeeAnalytics, EmployeeAnalytics } from '@/lib/analytics';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import SkeletonCard from '@/components/skeletons/SkeletonCard';

export default function EmployeeDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successMessage = searchParams.get('message');

  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      loadAnalytics();
    }
  }, [selectedCycleId]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      const { data: allCycles } = await reviewCyclesApi.getAll();
      setCycles(allCycles);

      // Select first active cycle or first cycle
      const activeCycle = allCycles.find((c) => c.status === 'ACTIVE');
      if (activeCycle) {
        setSelectedCycleId(activeCycle.id);
      } else if (allCycles.length > 0) {
        setSelectedCycleId(allCycles[0].id);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!selectedCycleId) return;

    try {
      const data = await getEmployeeAnalytics(selectedCycleId);
      setAnalytics(data);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-48" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white shadow rounded-lg h-72" />
          <div className="bg-white shadow rounded-lg h-72" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const radarData = analytics
    ? [
        {
          category: 'Self Review',
          score: analytics.scoreBreakdown.self || 0,
        },
        {
          category: 'Manager Review',
          score: analytics.scoreBreakdown.manager || 0,
        },
        {
          category: 'Peer Reviews',
          score: analytics.scoreBreakdown.peer || 0,
        },
      ]
    : [];

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3 text-sm text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user.name}! Track your performance and complete pending reviews.
        </p>
      </div>

      {/* Cycle Selector */}
      {cycles.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Cycle
          </label>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="block w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name} ({cycle.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Key Metrics */}
      {analytics && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Your Score
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.personalScore !== null
                        ? analytics.personalScore.toFixed(2)
                        : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
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
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Company Average
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.companyAverage?.toFixed(2) || 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
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
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Self Review
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.pendingTasks.selfReview ? (
                        <span className="text-orange-600">Pending</span>
                      ) : (
                        <span className="text-green-600">Complete</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending Peer Reviews
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.pendingTasks.peerReviews}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Breakdown and Review Counts */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Score Breakdown Radar Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Score Breakdown
            </h3>
            {analytics.personalScore !== null ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis domain={[0, 5]} />
                  <Radar
                    name="Your Scores"
                    dataKey="score"
                    stroke="#4f46e5"
                    fill="#4f46e5"
                    fillOpacity={0.6}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500 text-center">
                  No score data available yet.
                  <br />
                  Complete your reviews to see your breakdown.
                </p>
              </div>
            )}
          </div>

          {/* Review Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Review Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Self Review</span>
                <span className="text-sm">
                  {analytics.reviewCounts.self > 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
                      {analytics.pendingTasks.selfReview ? 'Pending' : 'Not Started'}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Manager Reviews</span>
                <span className="text-sm font-semibold text-gray-900">
                  {analytics.reviewCounts.manager} received
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Peer Reviews Received</span>
                <span className="text-sm font-semibold text-gray-900">
                  {analytics.reviewCounts.peer} received
                </span>
              </div>

              <div className="flex justify-between items-center py-3">
                <span className="text-sm font-medium text-gray-600">Peer Reviews to Complete</span>
                <span className="text-sm">
                  {analytics.pendingTasks.peerReviews > 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
                      {analytics.pendingTasks.peerReviews} pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                      All complete
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Comparison */}
      {analytics && analytics.personalScore !== null && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Performance Comparison
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Your Score</span>
                <span className="text-sm font-semibold text-indigo-600">
                  {analytics.personalScore.toFixed(2)} / 5.00
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full"
                  style={{ width: `${(analytics.personalScore / 5) * 100}%` }}
                ></div>
              </div>
            </div>

            {analytics.companyAverage && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Company Average</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {analytics.companyAverage.toFixed(2)} / 5.00
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gray-500 h-3 rounded-full"
                    style={{ width: `${(analytics.companyAverage / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {analytics.companyAverage && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Difference from Average</span>
                  <span
                    className={`text-lg font-semibold ${
                      analytics.personalScore >= analytics.companyAverage
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {analytics.personalScore >= analytics.companyAverage ? '+' : ''}
                    {(analytics.personalScore - analytics.companyAverage).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics?.pendingTasks?.selfReview && (
            <button
              onClick={() =>
                selectedCycleId &&
                router.push(`/employee/reviews/self?cycleId=${selectedCycleId}`)
              }
              className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Complete Self Review
            </button>
          )}
          {analytics?.pendingTasks?.peerReviews && analytics.pendingTasks.peerReviews > 0 && (
            <button
              onClick={() =>
                selectedCycleId &&
                router.push(`/employee/reviews/peer?cycleId=${selectedCycleId}`)
              }
              className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Complete Peer Reviews ({analytics.pendingTasks.peerReviews})
            </button>
          )}
          <button
            onClick={() =>
              selectedCycleId &&
              router.push(`/employee/scores?cycleId=${selectedCycleId}`)
            }
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View Detailed Scores
          </button>
        </div>
      </div>
    </div>
  );
}
