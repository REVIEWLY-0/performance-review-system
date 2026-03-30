'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getEmployeeAnalytics, EmployeeAnalytics } from '@/lib/analytics';
import {
  getEmployeesToReviewAsPeer,
  getEmployeesToReview,
  EmployeeToReview,
} from '@/lib/reviews';

function Icon({ name, fill = false, className = '', style }: { name: string; fill?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`, ...style }}
    >
      {name}
    </span>
  );
}

// ── Tips — title + body pairs, 2 random on mount ──────────────────────────────
const TIPS = [
  { title: 'Be Specific',        body: 'Use data points and specific outcomes to back up your self-assessment claims.' },
  { title: 'Look Forward',       body: 'Focus 30% on past performance and 70% on your future goals and growth areas.' },
  { title: 'Use Examples',       body: 'Concrete examples make feedback actionable and far easier to understand.' },
  { title: 'Stay Balanced',      body: 'Acknowledge both achievements and growth areas for a credible, trustworthy review.' },
  { title: 'Be Honest',          body: 'Honest self-reflection drives real growth — avoid underselling or overselling yourself.' },
  { title: 'Think Long-term',    body: 'Connect your current work to your bigger career goals and development path.' },
  { title: 'Focus on Impact',    body: 'Describe the impact of your work, not just the list of tasks you completed.' },
  { title: 'Avoid Recency Bias', body: 'Review your full contributions over the period, not just what happened most recently.' },
  { title: 'Be Constructive',    body: 'When reviewing peers, frame areas for improvement as opportunities, not criticism.' },
  { title: 'Use the SBI Model',  body: 'Situation, Behavior, Impact — a simple structure for giving clear, actionable feedback.' },
  { title: 'Rate Objectively',   body: 'Avoid the halo effect — one strong trait should not inflate all other ratings.' },
  { title: 'Take Your Time',     body: 'Quality feedback is worth the extra minutes. Rushed reviews help no one.' },
];

function pickTwo(): [typeof TIPS[0], typeof TIPS[0]] {
  const s = [...TIPS].sort(() => Math.random() - 0.5);
  return [s[0], s[1]];
}

// ── Circular days-remaining ring ──────────────────────────────────────────────
function DaysRing({ cycle }: { cycle: ReviewCycle | null }) {
  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <p className="text-sm text-on-surface-variant">No active cycle</p>
      </div>
    );
  }
  const start = new Date(cycle.startDate).getTime();
  const end = new Date(cycle.endDate).getTime();
  const now = Date.now();
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const pctLeft = Math.min(1, daysLeft / totalDays);
  const circ = 2 * Math.PI * 40; // r=40
  const offset = circ * (1 - pctLeft);
  const endLabel = new Date(cycle.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-2">
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="transparent" strokeWidth="8"
            className="stroke-primary/20 dark:stroke-primary/20" />
          <circle cx="48" cy="48" r="40" fill="transparent" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="stroke-primary transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-on-surface font-display">{daysLeft}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-on-surface font-bold font-display">Days Remaining</p>
        <p className="text-on-surface-variant text-xs mt-0.5">Cycle ends {endLabel}</p>
      </div>
    </div>
  );
}

// ── Avatar strip ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
];
function AvatarStack({ names }: { names: string[] }) {
  if (!names.length) return null;
  const shown = names.slice(0, 3);
  const extra = names.length - 3;
  return (
    <div className="flex -space-x-3">
      {shown.map((n, i) => (
        <div key={i}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-surface-container-low dark:border-[#131b2e] shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
          {n.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-surface-container-low dark:border-[#131b2e] bg-surface-container-high dark:bg-[#222a3d] text-on-surface-variant shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container-high dark:bg-[#1e293b] rounded-2xl ${className}`} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MyReviewsPage() {
  const router = useRouter();

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [allPeers, setAllPeers] = useState<EmployeeToReview[]>([]);
  const [allManagers, setAllManagers] = useState<EmployeeToReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [tips] = useState(pickTwo);
  const searchParams = useSearchParams();
  const successMessage = searchParams.get('message');

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const { data: allCycles } = await reviewCyclesApi.getAll();
      setCycles(allCycles);
      const active = allCycles.find((c) => c.status === 'ACTIVE') ?? allCycles[0] ?? null;
      if (active) {
        setSelectedCycle(active);
        await loadCycleData(active.id);
      }
    } catch (err) {
      console.error('My Reviews load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCycleData = async (cycleId: string) => {
    const [data, peers, managers] = await Promise.all([
      getEmployeeAnalytics(cycleId).catch((err) => { console.error('❌ Failed to load employee analytics:', err); return null; }),
      getEmployeesToReviewAsPeer(cycleId).catch((err) => { console.error('❌ Failed to load peer list:', err); return [] as EmployeeToReview[]; }),
      getEmployeesToReview(cycleId).catch((err) => { console.error('❌ Failed to load manager list:', err); return [] as EmployeeToReview[]; }),
    ]);
    setAnalytics(data);
    setAllPeers(peers);
    setAllManagers(managers);
  };

  const handleCycleChange = async (cycleId: string) => {
    const cycle = cycles.find((c) => c.id === cycleId) ?? null;
    setSelectedCycle(cycle);
    if (cycle) await loadCycleData(cycle.id);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const tc = analytics?.taskCounts;
  const pt = analytics?.pendingTasks;

  const selfSubmitted    = tc ? tc.selfCompleted > 0    : pt ? !pt.selfReview    : false;
  const peerTotal        = tc?.peerTotal     ?? allPeers.length;
  const peerCompleted    = tc?.peerCompleted ?? allPeers.filter((p) => p.reviewStatus === 'SUBMITTED').length;
  const managerTotal     = tc?.managerTotal  ?? allManagers.length;
  const managerCompleted = tc?.managerCompleted ?? allManagers.filter((m) => m.reviewStatus === 'SUBMITTED').length;

  const totalTasks     = 1 + peerTotal + managerTotal;
  const completedTasks = (selfSubmitted ? 1 : 0) + peerCompleted + managerCompleted;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const cycleId = selectedCycle?.id ?? '';
  const daysLeft = selectedCycle?.endDate
    ? Math.max(0, Math.ceil((new Date(selectedCycle.endDate).getTime() - Date.now()) / 86400000))
    : null;

  const activeTaskCount =
    (selfSubmitted ? 0 : 1) +
    (peerTotal > 0 && peerCompleted < peerTotal ? 1 : 0) +
    (managerTotal > 0 && managerCompleted < managerTotal ? 1 : 0);

  const avatarNames = [...allPeers, ...allManagers].map((p) => p.name);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="md:col-span-2 h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-32" />
        <div className="space-y-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Back to dashboard ─────────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/employee')}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 hover:bg-primary/15 dark:bg-primary/10 dark:hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors mb-6"
      >
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
        Back to Dashboard
      </button>

      {/* ── Success banner ────────────────────────────────────────────────── */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-2xl px-4 py-3">
          <Icon name="check_circle" fill className="text-green-600 text-[20px] shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      {/* ── Cycle selector ────────────────────────────────────────────────── */}
      {cycles.length > 1 && (
        <div className="mb-6 flex justify-end">
          <select
            value={selectedCycle?.id ?? ''}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="text-sm border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest dark:bg-[#131b2e] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* ── Progress bento (from first design) ────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-7 -mt-2">

        {/* Left — cycle name + progress bar */}
        <div className="md:col-span-2 bg-surface-container-lowest dark:bg-[#131b2e] rounded-xl p-10 relative overflow-hidden flex flex-col justify-between shadow-sm group">
          <div className="relative z-10">
            <h3 className="text-on-surface font-bold text-xl font-display mb-2">
              Review Cycle: {selectedCycle?.name ?? '—'}
            </h3>
            <p className="text-on-surface-variant text-sm max-w-md leading-relaxed">
              {pct === 100
                ? "You've completed all your reviews — great work this cycle!"
                : "You're making steady progress. Complete your self-assessment and peer reviews to stay on track for the quarterly wrap-up."}
            </p>
          </div>
          <div className="mt-8 flex items-end justify-between relative z-10">
            <div>
              <span className="text-sm font-semibold text-primary">{completedTasks} of {totalTasks} tasks completed</span>
              <div className="w-52 h-2 bg-surface-container-high dark:bg-[#222a3d] rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <AvatarStack names={avatarNames} />
          </div>
          {/* Decorative glow */}
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-110" />
        </div>

        {/* Right — circular days remaining */}
        <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-xl p-8 shadow-sm">
          <DaysRing cycle={selectedCycle} />
        </div>
      </section>

      {/* ── Tips section — above task list ────────────────────────────────── */}
      <section className="mb-7">
        <div className="bg-surface-container-high dark:bg-[#0f1729] border border-outline-variant/40 dark:border-transparent rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Icon name="tips_and_updates" fill className="text-primary text-[20px]" />
            <h3 className="text-base font-bold text-on-surface font-display">Review Tips</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {tips.map((tip, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-bold text-on-surface">{tip.title}</p>
                <p className="text-sm text-on-surface-variant leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Task list ─────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <h3 className="text-xs uppercase tracking-[0.2em] text-on-surface-variant font-bold mb-2">
          Current Tasks
        </h3>

        {/* No cycle guard */}
        {!selectedCycle && (
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-10 text-center border border-outline-variant/10 dark:border-transparent">
            <p className="text-sm font-medium text-on-surface-variant">No active review cycle found.</p>
            <p className="text-xs text-on-surface-variant mt-1">Contact your admin to activate a review cycle.</p>
          </div>
        )}

        {/* Self Assessment */}
        {selectedCycle && <div className="group bg-surface-container-lowest dark:bg-[#131b2e] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-surface-container dark:hover:bg-[#1a2440] border border-outline-variant/10 dark:border-transparent">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Icon name="person_edit" className="text-[22px]" />
            </div>
            <div>
              <h4 className="text-on-surface font-bold text-lg font-display">Self Assessment</h4>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {selfSubmitted ? (
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    Submitted ✓
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-400/10 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    In Progress
                  </span>
                )}
                {daysLeft !== null && (
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <Icon name="calendar_today" className="text-[13px]" />
                    Due in {daysLeft} days
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/employee/reviews/self?cycleId=${cycleId}`)}
            className={[
              'px-6 py-2.5 rounded-xl font-bold text-sm font-display transition-all active:scale-95 shrink-0',
              selfSubmitted
                ? 'bg-surface-container-high dark:bg-[#222a3d] text-on-surface hover:bg-surface-container-highest dark:hover:bg-[#2d3449]'
                : 'bg-primary text-on-primary hover:bg-primary-dim shadow-sm',
            ].join(' ')}
          >
            {selfSubmitted ? 'View Submission' : 'Continue'}
          </button>
        </div>}

        {/* Peer Reviews — only shown when assigned */}
        {peerTotal > 0 && (
          <div className="group bg-surface-container-lowest dark:bg-[#131b2e] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-surface-container dark:hover:bg-[#1a2440] border border-outline-variant/10 dark:border-transparent">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Icon name="group" className="text-[22px]" />
              </div>
              <div>
                <h4 className="text-on-surface font-bold text-lg font-display">Peer Reviews</h4>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    peerCompleted === peerTotal
                      ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                      : 'text-on-surface-variant bg-surface-container-high dark:bg-[#1e293b]'
                  }`}>
                    {peerCompleted} of {peerTotal} completed
                  </span>
                  {daysLeft !== null && (
                    <span className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Icon name="calendar_today" className="text-[13px]" />
                      Due in {daysLeft} days
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/employee/reviews/peer?cycleId=${cycleId}`)}
              className="bg-surface-container-high dark:bg-[#222a3d] hover:bg-surface-container-highest dark:hover:bg-[#2d3449] text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm font-display transition-all active:scale-95 shrink-0"
            >
              View Peers
            </button>
          </div>
        )}

        {/* Manager Review — only shown when assigned */}
        {managerTotal > 0 && (
          <div className="group bg-surface-container-lowest dark:bg-[#131b2e] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-surface-container dark:hover:bg-[#1a2440] border border-outline-variant/10 dark:border-transparent">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                <Icon name="manage_accounts" className="text-[22px]" />
              </div>
              <div>
                <h4 className="text-on-surface font-bold text-lg font-display">Manager Review</h4>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    managerCompleted === managerTotal
                      ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                      : 'text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/20'
                  }`}>
                    {managerCompleted === managerTotal ? 'All done ✓' : `${managerCompleted} of ${managerTotal} completed`}
                  </span>
                  {daysLeft !== null && (
                    <span className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Icon name="calendar_today" className="text-[13px]" />
                      Due in {daysLeft} days
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/employee/reviews/manager?cycleId=${cycleId}`)}
              className="bg-surface-container-high dark:bg-[#222a3d] hover:bg-surface-container-highest dark:hover:bg-[#2d3449] text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm font-display transition-all active:scale-95 shrink-0"
            >
              View Managers
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
