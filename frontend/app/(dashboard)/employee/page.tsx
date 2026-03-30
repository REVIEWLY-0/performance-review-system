'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getEmployeeAnalytics, EmployeeAnalytics } from '@/lib/analytics';
import { getEmployeesToReviewAsPeer, getEmployeesToReview, EmployeeToReview } from '@/lib/reviews';

function Icon({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
}

function CircularProgress({ pct }: { pct: number }) {
  const r = 78;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-48 h-48">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
        <circle cx="96" cy="96" r={r} fill="none" strokeWidth="14" className="stroke-surface-container-high dark:stroke-[#1e293b]" />
        <circle
          cx="96" cy="96" r={r} fill="none"
          strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="stroke-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-4xl font-extrabold text-on-surface font-display">{pct}%</span>
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Complete</span>
      </div>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container-high dark:bg-[#1e293b] rounded-2xl ${className}`} />;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successMessage = searchParams.get('message');

  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [pendingPeers, setPendingPeers] = useState<EmployeeToReview[]>([]);
  const [pendingManagers, setPendingManagers] = useState<EmployeeToReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoadError('');
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) setUser(currentUser);

      const { data: allCycles } = await reviewCyclesApi.getAll();
      setCycles(allCycles);

      const activeCycle = allCycles.find((c) => c.status === 'ACTIVE');
      const initial = activeCycle ?? (allCycles.length > 0 ? allCycles[0] : null);

      if (initial) {
        setSelectedCycle(initial);
        await loadCycleData(initial.id);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setLoadError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadCycleData = async (cycleId: string) => {
    try {
      const [data, peers, managers] = await Promise.all([
        getEmployeeAnalytics(cycleId),
        getEmployeesToReviewAsPeer(cycleId).catch((err) => { console.error('❌ Failed to load peer list:', err); return [] as EmployeeToReview[]; }),
        getEmployeesToReview(cycleId).catch((err) => { console.error('❌ Failed to load manager list:', err); return [] as EmployeeToReview[]; }),
      ]);
      setAnalytics(data);
      setPendingPeers(peers.filter((p) => p.reviewStatus !== 'SUBMITTED'));
      setPendingManagers(managers.filter((m) => m.reviewStatus !== 'SUBMITTED'));
    } catch (err) {
      console.error('❌ Failed to load analytics:', err);
    }
  };

  const handleCycleChange = async (cycleId: string) => {
    const cycle = cycles.find((c) => c.id === cycleId) ?? null;
    setSelectedCycle(cycle);
    setAnalyticsLoading(true);
    try { await loadCycleData(cycleId); }
    finally { setAnalyticsLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2"><Skeleton className="h-10 w-64" /><Skeleton className="h-5 w-72" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-[480px]" />
          <div className="lg:col-span-5 space-y-5">
            <Skeleton className="h-64" /><Skeleton className="h-44" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── Derived values ──────────────────────────────────────────────────────────
  const tc = analytics?.taskCounts;
  const pt = analytics?.pendingTasks;

  // Use taskCounts when available, fall back to pendingTasks for self
  const selfCompleted = tc ? tc.selfCompleted > 0 : pt ? !pt.selfReview : false;
  // Fall back to pending list lengths so legend never shows "None assigned" when items exist
  const peerTotal     = tc?.peerTotal     ?? pendingPeers.length;
  const peerCompleted = tc?.peerCompleted ?? 0;
  const managerTotal  = tc?.managerTotal  ?? pendingManagers.length;
  const managerCompleted = tc?.managerCompleted ?? 0;

  const totalTasks    = (tc ? tc.selfTotal : 1) + peerTotal + managerTotal;
  const completedTasks = (selfCompleted ? 1 : 0) + peerCompleted + managerCompleted;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const pendingCount =
    (pt?.selfReview ? 1 : 0) +
    (pt?.peerReviews ?? 0) +
    (pt?.managerReviews ?? 0);

  const scoreStatus = !analytics
    ? '—'
    : analytics.allReviewsComplete
      ? 'Available'
      : 'In Progress';

  const pendingItems = [
    ...(pt?.selfReview
      ? [{ key: 'self', label: 'Self Assessment', sub: 'Your own review', icon: 'edit_note', href: `/employee/reviews/self?cycleId=${selectedCycle?.id}` }]
      : []),
    ...pendingPeers.map((p) => ({
      key: `peer-${p.id}`,
      label: p.name,
      sub: p.department || 'Peer Review',
      icon: 'person',
      href: `/employee/reviews/peer/${p.id}?cycleId=${selectedCycle?.id}`,
    })),
    ...pendingManagers.map((m) => ({
      key: `mgr-${m.id}`,
      label: m.name,
      sub: m.department || 'Manager Review',
      icon: 'manage_accounts',
      href: `/employee/reviews/manager/${m.id}?cycleId=${selectedCycle?.id}`,
    })),
  ];

  const firstName = user.name.split(' ')[0];
  const progressLabel = pct === 100 ? 'Complete' : pct > 50 ? 'On Track' : 'In Progress';
  const progressColor = pct === 100
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : pct > 50
      ? 'bg-primary/10 text-primary'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

  return (
    <div className={analyticsLoading ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>

      {/* Success banner */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl px-4 py-3">
          <Icon name="check_circle" fill className="text-green-600 text-[20px] shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      {/* Load error — surface the problem with a retry instead of silent empty state */}
      {loadError && (
        <div className="mb-6 flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl px-4 py-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{loadError}</p>
          <button
            onClick={loadData}
            className="shrink-0 text-sm font-semibold text-red-700 dark:text-red-400 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Welcome header ───────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight font-display">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            {pendingCount > 0 ? (
              <>You have <span className="text-primary font-bold">{pendingCount} pending task{pendingCount !== 1 ? 's' : ''}</span> for the current review cycle.</>
            ) : (
              <>You&apos;re all caught up for the current cycle. Great work!</>
            )}
          </p>
        </div>
        {cycles.length > 1 && (
          <select
            value={selectedCycle?.id ?? ''}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="text-sm border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest dark:bg-[#131b2e] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-7 shadow-sm flex flex-col gap-5">
          <p className="text-base font-semibold text-primary">Active Review Cycle</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold text-on-surface leading-tight">{selectedCycle?.name ?? 'None'}</p>
            <Icon name="calendar_today" fill className="text-primary text-[32px]" />
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-7 shadow-sm flex flex-col gap-5">
          <p className="text-base font-semibold text-primary">Pending Tasks</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold text-on-surface">{pendingCount}</p>
            <Icon name="assignment_late" fill className={`text-[32px] ${pendingCount > 0 ? 'text-error' : 'text-on-surface-variant'}`} />
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-7 shadow-sm flex flex-col gap-5">
          <p className="text-base font-semibold text-primary">Score Status</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold text-on-surface">{scoreStatus}</p>
            <div className="flex gap-1 items-end pb-0.5">
              <div className={`w-2 h-6 rounded-full ${completedTasks > 0 ? 'bg-primary' : 'bg-surface-container-high dark:bg-[#1e293b]'}`} />
              <div className={`w-2 h-6 rounded-full ${completedTasks >= totalTasks / 2 ? 'bg-primary' : 'bg-surface-container-high dark:bg-[#1e293b]'}`} />
              <div className={`w-2 h-6 rounded-full ${pct === 100 ? 'bg-primary' : 'bg-surface-container-high dark:bg-[#1e293b]'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bento grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left — Review Progress */}
        <div className="lg:col-span-7 bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-8 shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-on-surface font-display">Review Progress</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">{selectedCycle?.name ?? 'Current cycle'}</p>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${progressColor}`}>
              {progressLabel}
            </span>
          </div>

          {/* Circle */}
          <div className="flex flex-col items-center py-2">
            <CircularProgress pct={pct} />

            {/* Legend */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
              {/* Self */}
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${selfCompleted ? 'bg-primary' : 'bg-outline-variant'}`} />
                <div>
                  <p className="text-sm font-bold text-on-surface">Self Assessment</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{selfCompleted ? 'Submitted ✓' : 'Pending'}</p>
                </div>
              </div>

              {/* Peer */}
              {peerTotal > 0 ? (
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${peerCompleted === peerTotal ? 'bg-primary' : 'bg-primary/40'}`} />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Peer Reviews</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{peerCompleted}/{peerTotal} submitted</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-outline-variant" />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Peer Reviews</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">None assigned</p>
                  </div>
                </div>
              )}

              {/* Manager */}
              {managerTotal > 0 ? (
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${managerCompleted === managerTotal ? 'bg-primary' : 'bg-primary/30'}`} />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Manager Reviews</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{managerCompleted}/{managerTotal} submitted</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-outline-variant" />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Manager Reviews</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">None assigned</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score reveal */}
          {analytics?.allReviewsComplete && analytics.personalScore !== null && (
            <div className="mt-8 pt-6 border-t border-outline-variant/30 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs text-on-surface-variant font-medium">Your Final Score</p>
                <p className="text-3xl font-extrabold text-primary mt-0.5">{analytics.personalScore.toFixed(2)}</p>
              </div>
              <button
                onClick={() => router.push(`/employee/scores?cycleId=${selectedCycle?.id}`)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dim transition-colors"
              >
                View breakdown <Icon name="arrow_forward" className="text-[18px]" />
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 flex flex-col gap-5">

          {/* Pending Reviews */}
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-on-surface font-display">Pending Reviews</h2>
              {pendingItems.length > 0 && (
                <span className="text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                  {pendingItems.length}
                </span>
              )}
            </div>

            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Icon name="check_circle" fill className="text-[44px] text-green-500 mb-2" />
                <p className="text-sm font-bold text-on-surface">All done!</p>
                <p className="text-xs text-on-surface-variant mt-0.5">No pending reviews right now.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => router.push(item.href)}
                    className="group w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low dark:bg-[#0b1326] hover:bg-surface-container-high dark:hover:bg-[#1e293b] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center shrink-0">
                        <Icon name={item.icon} className="text-primary text-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{item.label}</p>
                        <p className="text-xs text-on-surface-variant truncate">{item.sub}</p>
                      </div>
                    </div>
                    <Icon name="chevron_right" className="text-on-surface-variant group-hover:text-primary transition-colors text-[20px] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-primary dark:bg-[#1e3a6e] rounded-2xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            <h2 className="text-white font-bold text-base font-display mb-4 relative z-10">Quick Actions</h2>
            <div className="space-y-2.5 relative z-10">
              {pt?.selfReview && (
                <button
                  onClick={() => router.push(`/employee/reviews/self?cycleId=${selectedCycle?.id}`)}
                  className="w-full bg-white dark:bg-white/10 dark:hover:bg-white/20 text-primary dark:text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center gap-2.5 hover:bg-white/90 transition-colors active:scale-[0.98] duration-150"
                >
                  <Icon name="edit_note" className="text-[18px]" />
                  Complete Self Review
                </button>
              )}
              {(pt?.peerReviews ?? 0) > 0 && (
                <button
                  onClick={() => router.push(`/employee/reviews/peer?cycleId=${selectedCycle?.id}`)}
                  className="w-full bg-white dark:bg-white/10 dark:hover:bg-white/20 text-primary dark:text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center gap-2.5 hover:bg-white/90 transition-colors active:scale-[0.98] duration-150"
                >
                  <Icon name="group" className="text-[18px]" />
                  Peer Reviews ({pt?.peerReviews})
                </button>
              )}
              {(pt?.managerReviews ?? 0) > 0 && (
                <button
                  onClick={() => router.push(`/employee/reviews/manager?cycleId=${selectedCycle?.id}`)}
                  className="w-full bg-white dark:bg-white/10 dark:hover:bg-white/20 text-primary dark:text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center gap-2.5 hover:bg-white/90 transition-colors active:scale-[0.98] duration-150"
                >
                  <Icon name="manage_accounts" className="text-[18px]" />
                  Manager Reviews ({pt?.managerReviews})
                </button>
              )}
              {analytics?.allReviewsComplete ? (
                <button
                  onClick={() => router.push(`/employee/scores?cycleId=${selectedCycle?.id}`)}
                  className="w-full bg-white/15 hover:bg-white/25 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center gap-2.5 transition-colors active:scale-[0.98] duration-150"
                >
                  <Icon name="analytics" className="text-[18px]" />
                  View Score Breakdown
                </button>
              ) : (
                <div className="w-full bg-white/5 text-white/40 font-bold py-3 px-4 rounded-xl text-sm flex items-center gap-2.5 cursor-not-allowed">
                  <Icon name="lock" className="text-[18px]" />
                  Score Breakdown — Complete all reviews first
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
