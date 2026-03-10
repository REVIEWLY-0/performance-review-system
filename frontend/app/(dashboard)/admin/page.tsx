'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getAdminAnalytics, AdminAnalytics } from '@/lib/analytics';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import SkeletonCard from '@/components/skeletons/SkeletonCard';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch user + cycles in parallel — both only need the stored JWT token
      const [currentUser, cyclesResult] = await Promise.all([
        getCurrentUser(),
        reviewCyclesApi.getAll().catch(() => ({ data: [] as ReviewCycle[] })),
      ]);

      if (!currentUser) {
        console.log('⚠️  No user found, redirecting to login');
        const { signOut } = await import('@/lib/auth');
        await signOut();
        router.push('/login');
        return;
      }

      if (currentUser.role !== 'ADMIN') {
        console.log('⚠️  Not admin, redirecting');
        router.push('/employee');
        return;
      }

      setUser(currentUser);

      const allCycles = cyclesResult.data;
      setCycles(allCycles);

      // Select first active cycle or first cycle, then load analytics inline
      const initialCycle =
        allCycles.find((c) => c.status === 'ACTIVE') ?? allCycles[0];
      if (initialCycle) {
        setSelectedCycleId(initialCycle.id);
        try {
          const data = await getAdminAnalytics(initialCycle.id);
          setAnalytics(data);
        } catch (err: any) {
          console.error('Error loading analytics:', err);
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      const { signOut } = await import('@/lib/auth');
      await signOut();
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleCycleChange = async (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    setAnalyticsLoading(true);
    try {
      const data = await getAdminAnalytics(newCycleId);
      setAnalytics(data);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const allChartData = analytics
    ? [
        { name: 'Submitted', value: analytics.reviewProgress.submitted, color: '#10b981' },
        { name: 'Draft', value: analytics.reviewProgress.draft, color: '#f59e0b' },
        { name: 'Not Started', value: analytics.reviewProgress.notStarted, color: '#6b7280' },
      ]
    : [];
  // Only pass non-zero slices to Recharts — zero-value entries cause label overlap
  const chartData = allChartData.filter((d) => d.value > 0);
  const chartEmpty = analytics !== null && chartData.length === 0;

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user.name}! Manage your organization's performance reviews.
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
            onChange={(e) => handleCycleChange(e.target.value)}
            disabled={analyticsLoading}
            className="block w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Employees
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics?.totalEmployees ?? 0}
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
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Average Score
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics?.averageScore?.toFixed(2) ?? 'N/A'}
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
                    Completion Rate
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics?.completionRate ?? 0}%
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Reviews
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {analytics
                      ? analytics.pendingReviews.selfReviews +
                        analytics.pendingReviews.managerReviews +
                        analytics.pendingReviews.peerReviews
                      : 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State for No Cycle Selected */}
      {!selectedCycleId && cycles.length > 0 && (
        <div className="mb-6 rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Select a review cycle above to view analytics and insights.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts and Top Performers */}
      <div className={analyticsLoading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Progress Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Review Progress
            </h3>
            {chartEmpty ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                <svg className="h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <p className="text-sm">No reviews started yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Performers */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Top Performers
            </h3>
            <div className="space-y-3">
              {analytics.topPerformers.length > 0 ? (
                analytics.topPerformers.map((emp, idx) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center">
                      <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-semibold text-indigo-600">
                        {idx + 1}
                      </span>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {emp.name}
                        </p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-indigo-600">
                      {emp.score?.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No scores available yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/admin/review-cycles/new')}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            🔄 Start New Cycle
          </button>
          <button
            onClick={() => router.push('/admin/employees')}
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            👥 Manage Employees
          </button>
          <button
            onClick={() => router.push('/admin/questions')}
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ❓ Edit Questions
          </button>
          <button
            onClick={() => router.push('/admin/review-types')}
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            🏷️ Review Types
          </button>
          <button
            onClick={() => router.push('/admin/departments')}
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            🏢 Departments
          </button>
          <button
            onClick={() =>
              selectedCycleId &&
              router.push(`/admin/cycles/${selectedCycleId}/scores`)
            }
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            📊 View Reports
          </button>
        </div>
      </div>
    </div>
  );
}
