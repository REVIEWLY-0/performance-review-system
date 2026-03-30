'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getManagerAnalytics, getEmployeeAnalytics, ManagerAnalytics, EmployeeAnalytics } from '@/lib/analytics';
import { orgChartApi } from '@/lib/org-chart';
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
  const [loadError, setLoadError] = useState('');
  const [hasOrgChart, setHasOrgChart] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoadError('');
    try {
      // Layout already verified auth — just fetch the user object from cache
      const currentUser = await getCurrentUser();
      if (currentUser) setUser(currentUser);

      const [{ data: allCycles }, orgNodes] = await Promise.all([
        reviewCyclesApi.getAll(),
        orgChartApi.getAll().catch(() => []),
      ]);
      setCycles(allCycles);
      setHasOrgChart(orgNodes.length > 0);

      const activeCycle = allCycles.find((c) => c.status === 'ACTIVE');
      const initialCycle = activeCycle ?? (allCycles.length > 0 ? allCycles[0] : null);

      if (initialCycle) {
        setSelectedCycleId(initialCycle.id);
        const [managerData, employeeData] = await Promise.all([
          getManagerAnalytics(initialCycle.id),
          getEmployeeAnalytics(initialCycle.id),
        ]);
        setAnalytics(managerData);
        setMyAnalytics(employeeData);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setLoadError(err.message || 'Failed to load dashboard data');
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
          <div className="h-7 bg-surface-container-high rounded w-48" />
          <div className="mt-2 h-4 bg-surface-container-high rounded w-72" />
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

  if (loadError && !user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-on-surface-variant">{loadError}</p>
        <button
          onClick={loadData}
          className="px-5 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary-dim"
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const scoresLocked = selectedCycle?.status !== 'COMPLETED';

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
        <h1 className="text-2xl font-bold text-on-surface">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Welcome back, {user?.name}! Track your team's performance.
        </p>
      </div>

      {/* Cycle Selector */}
      {cycles.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-on-surface-variant mb-2">
            Review Cycle
          </label>
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            disabled={analyticsLoading}
            className="block w-full md:w-96 px-3 py-2 border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:opacity-60"
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
        <div className="bg-surface-container-lowest shadow rounded-lg p-10 text-center mb-6">
          <svg className="mx-auto h-12 w-12 text-on-surface-variant mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-on-surface mb-1">No review cycles yet</h3>
          <p className="text-sm text-on-surface-variant">Your admin hasn't started a review cycle. Check back later.</p>
        </div>
      )}

      {/* Analytics sections — fades while a cycle change is in flight */}
      <div className={analyticsLoading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>

        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <div className="bg-surface-container-lowest overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-on-surface-variant truncate">Team Size</dt>
                      <dd className="text-lg font-semibold text-on-surface">{analytics.teamSize}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-on-surface-variant truncate">Team Average Score</dt>
                      <dd className="text-lg font-semibold text-on-surface">
                        {scoresLocked ? '—' : (analytics.teamAverageScore?.toFixed(2) || 'N/A')}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-on-surface-variant truncate">Pending Team Reviews</dt>
                      <dd className="text-lg font-semibold text-on-surface">{analytics.pendingReviews}</dd>
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
            <div className="bg-surface-container-lowest shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-on-surface mb-4">Performance Comparison</h3>
              {scoresLocked ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-on-surface-variant">
                  <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm font-medium">Scores are locked until the cycle completes</p>
                </div>
              ) : (
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
              )}
            </div>

            <div className="bg-surface-container-lowest shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-on-surface mb-4">Team Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-outline-variant">
                  <span className="text-sm font-medium text-on-surface-variant">Team Size</span>
                  <span className="text-lg font-semibold text-on-surface">{analytics.teamSize} members</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-outline-variant">
                  <span className="text-sm font-medium text-on-surface-variant">Team Average</span>
                  <span className="text-lg font-semibold text-primary">
                    {scoresLocked ? '—' : (analytics.teamAverageScore?.toFixed(2) || 'N/A')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-outline-variant">
                  <span className="text-sm font-medium text-on-surface-variant">Company Average</span>
                  <span className="text-lg font-semibold text-on-surface">
                    {scoresLocked ? '—' : (analytics.companyAverageScore?.toFixed(2) || 'N/A')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm font-medium text-on-surface-variant">Difference</span>
                  <span
                    className={`text-lg font-semibold ${
                      scoresLocked ? 'text-on-surface-variant' :
                      (analytics.teamAverageScore || 0) >= (analytics.companyAverageScore || 0)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {scoresLocked ? '—' : analytics.teamAverageScore && analytics.companyAverageScore
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
          <div className="bg-surface-container-lowest shadow rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-medium text-on-surface">Team Members</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Reviews Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-surface-container-lowest divide-y divide-outline-variant">
                  {analytics.teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-surface-container-low">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-on-surface">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-on-surface-variant">{member.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {scoresLocked ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Locked
                          </span>
                        ) : member.score !== null ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
                            {member.score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-on-surface-variant">No score yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-on-surface">
                          {member.reviewsCompleted} / {member.reviewsTotal}
                        </div>
                        <div className="w-full bg-surface-container-high rounded-full h-2 mt-1">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${member.reviewsTotal > 0 ? (member.reviewsCompleted / member.reviewsTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/manager/reviews?employeeId=${member.id}&cycleId=${selectedCycleId}`)}
                          className="text-primary hover:text-primary-dim font-medium"
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
          <div className="bg-surface-container-lowest shadow rounded-lg p-8 text-center mb-6">
            <svg className="mx-auto h-10 w-10 text-on-surface-variant mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-on-surface">No team members assigned yet</p>
            <p className="mt-1 text-sm text-on-surface-variant">Team members will appear here once reviewer assignments are set up.</p>
          </div>
        )}

      </div>{/* end analytics fade wrapper */}

      {/* Quick Actions */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-on-surface mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {/* Primary: review team members — hidden once all downward reviews submitted */}
          {(!analytics || analytics.pendingReviews > 0) && (
            <button
              onClick={() => router.push('/manager/reviews')}
              className="flex-1 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl text-on-primary bg-primary hover:bg-primary-dim whitespace-nowrap"
            >
              Review Team Members
            </button>
          )}

          {/* Own self-review — only shown if the manager has one pending */}
          {myAnalytics?.pendingTasks?.selfReview && (
            <button
              onClick={() =>
                selectedCycleId &&
                router.push(`/employee/reviews/self?cycleId=${selectedCycleId}`)
              }
              className="flex-1 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl text-on-primary bg-primary hover:bg-primary-dim whitespace-nowrap"
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
              className="flex-1 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl text-on-primary bg-primary hover:bg-primary-dim whitespace-nowrap"
            >
              Complete Peer Reviews ({myAnalytics.pendingTasks.peerReviews})
            </button>
          )}

          <button
            onClick={() => router.push('/manager/reviews')}
            className="flex-1 inline-flex items-center justify-center px-5 py-2.5 border border-outline-variant/50 dark:border-white/[0.08] text-sm font-semibold rounded-xl text-on-surface-variant bg-surface-container dark:bg-[#1a2440] hover:bg-surface-container-high dark:hover:bg-[#222a3d] whitespace-nowrap"
          >
            View Team Scores
          </button>
          {hasOrgChart && (
            <button
              onClick={() => router.push('/organogram')}
              className="flex-1 inline-flex items-center justify-center px-5 py-2.5 border border-outline-variant/50 dark:border-white/[0.08] text-sm font-semibold rounded-xl text-on-surface-variant bg-surface-container dark:bg-[#1a2440] hover:bg-surface-container-high dark:hover:bg-[#222a3d] whitespace-nowrap"
            >
              Organogram
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
