'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getAdminAnalytics, AdminAnalytics } from '@/lib/analytics';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import SkeletonCard from '@/components/skeletons/SkeletonCard';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [cyclePickerOpen, setCyclePickerOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, cyclesResult] = await Promise.all([
        getCurrentUser(),
        reviewCyclesApi.getAll().catch(() => ({ data: [] as ReviewCycle[] })),
      ]);

      if (!currentUser) {
        const { signOut } = await import('@/lib/auth');
        await signOut();
        router.push('/login');
        return;
      }

      if (currentUser.role !== 'ADMIN') {
        router.push('/employee');
        return;
      }

      setUser(currentUser);

      const allCycles = cyclesResult.data;
      setCycles(allCycles);

      const initialCycle = allCycles.find((c) => c.status === 'ACTIVE') ?? allCycles[0];
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
    setCyclePickerOpen(false);
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
      <div className="space-y-8">
        <div>
          <div className="h-8 bg-surface-container-high rounded w-56 animate-pulse" />
          <div className="mt-2 h-5 bg-surface-container-high rounded w-80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  const allChartData = analytics
    ? [
        { name: 'Submitted', value: analytics.reviewProgress.submitted, color: '#0053dc' },
        { name: 'Draft',     value: analytics.reviewProgress.draft,     color: '#f59e0b' },
        { name: 'Not Started', value: analytics.reviewProgress.notStarted, color: '#e2e7ff' },
      ]
    : [];
  const chartData = allChartData.filter((d) => d.value > 0);
  const chartEmpty = analytics !== null && chartData.length === 0;
  const totalPending = analytics
    ? analytics.pendingReviews.selfReviews + analytics.pendingReviews.managerReviews + analytics.pendingReviews.peerReviews
    : 0;

  return (
    <div className="space-y-8">
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface font-display">
          Admin Dashboard
        </h1>
        <p className="text-on-surface-variant text-base">
          Welcome back, {user.name}! Manage your organization&apos;s performance reviews.
        </p>
      </div>

      {/* ── Bento Grid ──────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-12 gap-6 ${analyticsLoading ? 'opacity-60 pointer-events-none' : ''} transition-opacity`}>

        {/* Cycle selector card */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl flex items-center justify-between shadow-sm border border-outline-variant/10 dark:border-transparent dark:border-transparent">
          <div className="flex items-center gap-4">
            <div className="bg-surface-container p-3 rounded-lg text-on-surface-variant">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Current Active Cycle
              </p>
              <h2 className="text-xl font-semibold font-display">
                {selectedCycle ? `${selectedCycle.name} ${selectedCycle.status}` : cycles.length > 0 ? 'Select a cycle' : 'No cycles yet'}
              </h2>
            </div>
          </div>

          {cycles.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setCyclePickerOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-primary font-bold text-sm hover:bg-surface-container-high transition-colors"
              >
                <span>Change Cycle</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {cyclePickerOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-outline-variant/20 dark:border-white/[0.06] z-10 overflow-hidden">
                  {cycles.map((cycle) => (
                    <button
                      key={cycle.id}
                      onClick={() => handleCycleChange(cycle.id)}
                      className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-surface-container transition-colors ${
                        cycle.id === selectedCycleId ? 'text-primary font-bold bg-surface-container-low' : 'text-on-surface'
                      }`}
                    >
                      {cycle.name}
                      <span className="ml-2 text-xs text-on-surface-variant">{cycle.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Primary CTA card */}
        <div className="col-span-12 lg:col-span-4 bg-primary text-on-primary p-6 rounded-xl shadow-lg shadow-primary/20 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold font-display leading-tight">Ready for a new review phase?</h3>
            <p className="text-on-primary/70 text-sm mt-1 font-medium">Initiate and configure the next performance window.</p>
          </div>
          <button
            onClick={() => router.push('/admin/review-cycles/new')}
            className="mt-4 bg-on-primary text-primary w-full py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Start New Cycle
          </button>
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────── */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Employees */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-blue-50 dark:bg-blue-950 text-primary rounded-lg">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Total Employees</p>
            <h4 className="text-3xl font-semibold font-display mt-1">{analytics?.totalEmployees ?? 0}</h4>
          </div>

          {/* Average Score */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-surface-container text-on-surface-variant rounded-lg">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Average Score</p>
            <h4 className={`text-3xl font-semibold font-display mt-1 ${!analytics?.averageScore ? 'text-on-surface-variant/40' : ''}`}>
              {analytics?.averageScore?.toFixed(2) ?? 'N/A'}
            </h4>
          </div>

          {/* Completion Rate */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Completion Rate</p>
            <h4 className="text-3xl font-semibold font-display mt-1">{analytics?.completionRate ?? 0}%</h4>
          </div>

          {/* Pending Reviews */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-red-50 dark:bg-red-950 text-error rounded-lg">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Pending Reviews</p>
            <h4 className="text-3xl font-semibold font-display mt-1">{totalPending}</h4>
          </div>
        </div>

        {/* ── Charts ────────────────────────────────────────────────────── */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Review Progress */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent flex flex-col items-center justify-between min-h-[300px]">
            <div className="w-full flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Review Progress</h3>
              {!chartEmpty && chartData.length > 0 && (
                <div className="flex gap-4 text-[10px] font-bold">
                  {chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {chartEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative w-40 h-40 rounded-full border-[16px] border-surface-container flex items-center justify-center">
                  <span className="text-3xl font-black font-display text-on-surface-variant/30">0%</span>
                </div>
                <p className="text-sm text-on-surface-variant font-bold mt-4">No reviews submitted yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Performers */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent flex flex-col min-h-[300px]">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Top Performers</h3>
            {analytics && analytics.topPerformers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topPerformers.map((emp, idx) => (
                  <div key={emp.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{emp.name}</p>
                        <p className="text-xs text-on-surface-variant">{emp.email}</p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-primary">{emp.score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <div className="w-16 h-16 mb-4 bg-surface-container rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-on-surface-variant/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-on-surface font-semibold text-base">No scores available yet</p>
                <p className="text-on-surface-variant text-sm mt-1">Scores will appear once reviews are finalized.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Management ──────────────────────────────────────────── */}
        <div className="col-span-12 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10 dark:border-transparent">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Quick Management</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { emoji: '👥', label: 'Manage Employees', href: '/admin/employees' },
              { emoji: '❓', label: 'Edit Questions',   href: '/admin/questions' },
              { emoji: '📁', label: 'Review Types',     href: '/admin/review-types' },
              { emoji: '🏢', label: 'Departments',      href: '/admin/departments' },
              { emoji: '🏗️', label: 'Organogram',      href: '/organogram' },
              {
                emoji: '📊',
                label: 'View Reports',
                href: selectedCycleId ? `/admin/cycles/${selectedCycleId}/scores` : '/admin/review-cycles',
              },
            ].map(({ emoji, label, href }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="flex items-center justify-center gap-2 p-4 rounded-xl border border-outline-variant/20 dark:border-white/[0.06] bg-surface-container dark:bg-[#1a2440] hover:bg-surface-container-high dark:hover:bg-[#222a3d] transition-all font-semibold text-sm text-on-surface"
              >
                <span className="text-lg">{emoji}</span> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-64 -z-10 w-[300px] h-[300px] bg-tertiary/5 blur-[80px] rounded-full pointer-events-none" />
    </div>
  );
}
