'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getManagerAnalytics, getEmployeeAnalytics, ManagerAnalytics, EmployeeAnalytics } from '@/lib/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonTable from '@/components/skeletons/SkeletonTable';

export default function ManagerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [analytics, setAnalytics] = useState<ManagerAnalytics | null>(null);
  const [myAnalytics, setMyAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

      const activeCycle = allCycles.find((c) => c.status === 'ACTIVE');
      const initialCycle = activeCycle ?? (allCycles.length > 0 ? allCycles[0] : null);

      if (initialCycle) {
        setSelectedCycleId(initialCycle.id);
        // Fetch both manager and personal analytics inline so they're ready
        // before loading goes false — avoids blank dashboard on initial render.
        try {
          const [managerData, employeeData] = await Promise.all([
            getManagerAnalytics(initialCycle.id),
            getEmployeeAnalytics(initialCycle.id),
          ]);
          setAnalytics(managerData);
          setMyAnalytics(employeeData);
        } catch (err: any) {
          console.error('Error loading analytics:', err);
        }
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCycleChange = async (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    setAnalyticsLoading(true);
    try {
      const [managerData, employeeData] = await Promise.all([
        getManagerAnalytics(newCycleId),
        getEmployeeAnalytics(newCycleId),
      ]);
      setAnalytics(managerData);
      setMyAnalytics(employeeData);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setAnalytics(null);
      setMyAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-48" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (!user) return null;

  const chartData = analytics
    ? [
        {
          name: 'Your Team',
          score: analytics.teamAverageScore || 0,
        },
        {
          name: 'Company Average',
          score: analytics.companyAverageScore || 0,
        },
      ]
    : [];

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user.name}! Track your team's performance.
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

      {/* No cycles empty state */}
      {cycles.length === 0 && (
        <div className="bg-white shadow rounded-lg p-10 text-center mb-6">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No review cycles yet</h3>
          <p className="text-sm text-gray-500">Your admin hasn't started a review cycle. Check back later.</p>
        </div>
      )}

      {/* Analytics sections — fades while a cycle change is in flight */}
      <div className={analyticsLoading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>

        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Team Size</dt>
                      <dd className="text-lg font-semibold text-gray-900">{analytics.teamSize}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Team Average Score</dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {analytics.teamAverageScore?.toFixed(2) || 'N/A'}
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
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Team Reviews</dt>
                      <dd className="text-lg font-semibold text-gray-900">{analytics.pendingReviews}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Performance Chart and Team Summary */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#4f46e5" name="Average Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Team Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Team Size</span>
                  <span className="text-lg font-semibold text-gray-900">{analytics.teamSize} members</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Team Average</span>
                  <span className="text-lg font-semibold text-indigo-600">
                    {analytics.teamAverageScore?.toFixed(2) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Company Average</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {analytics.companyAverageScore?.toFixed(2) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm font-medium text-gray-600">Difference</span>
                  <span
                    className={`text-lg font-semibold ${
                      (analytics.teamAverageScore || 0) >= (analytics.companyAverageScore || 0)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {analytics.teamAverageScore && analytics.companyAverageScore
                      ? (analytics.teamAverageScore - analytics.companyAverageScore > 0 ? '+' : '') +
                        (analytics.teamAverageScore - analytics.companyAverageScore).toFixed(2)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Members Table */}
        {analytics && analytics.teamMembers.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviews Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {member.score !== null ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
                            {member.score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No score yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {member.reviewsCompleted} / {member.reviewsTotal}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{
                              width: `${member.reviewsTotal > 0 ? (member.reviewsCompleted / member.reviewsTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/manager/reviews?employeeId=${member.id}&cycleId=${selectedCycleId}`)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state: cycle selected but no team members */}
        {analytics && analytics.teamMembers.length === 0 && (
          <div className="bg-white shadow rounded-lg p-8 text-center mb-6">
            <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">No team members assigned yet</p>
            <p className="mt-1 text-sm text-gray-500">Team members will appear here once reviewer assignments are set up.</p>
          </div>
        )}

      </div>{/* end analytics fade wrapper */}

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Primary: review team members */}
          <button
            onClick={() => router.push('/manager/reviews')}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Review Team Members
          </button>

          {/* Own self-review — only shown if the manager has one pending */}
          {myAnalytics?.pendingTasks?.selfReview && (
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

          {/* Own peer reviews — only shown if the manager has pending ones */}
          {myAnalytics?.pendingTasks?.peerReviews != null &&
            myAnalytics.pendingTasks.peerReviews > 0 && (
            <button
              onClick={() =>
                selectedCycleId &&
                router.push(`/employee/reviews/peer?cycleId=${selectedCycleId}`)
              }
              className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Complete Peer Reviews ({myAnalytics.pendingTasks.peerReviews})
            </button>
          )}

          <button
            onClick={() =>
              selectedCycleId &&
              router.push(`/admin/cycles/${selectedCycleId}/scores`)
            }
            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            View Team Scores
          </button>
        </div>
      </div>
    </div>
  );
}
