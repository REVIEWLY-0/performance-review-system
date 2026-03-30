'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { calculateScore, FinalScore } from '@/lib/scoring';
import { ratingScaleApi, DEFAULT_SCALE } from '@/lib/rating-scale';

function Icon({ name, fill = false, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined${fill ? ' fill' : ''} ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container-high dark:bg-[#1e293b] rounded-2xl ${className}`} />;
}

export default function EmployeeScoresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleParam = searchParams.get('cycleId');

  const [user, setUser] = useState<User | null>(null);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycleParam || '');
  const [scoreData, setScoreData] = useState<FinalScore | null>(null);
  const [maxRating, setMaxRating] = useState(DEFAULT_SCALE.maxRating);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [currentUser, scale, { data: allCycles }] = await Promise.all([
        getCurrentUser(),
        ratingScaleApi.get(),
        reviewCyclesApi.getAll(),
      ]);
      if (!currentUser) { setLoading(false); return; }
      setUser(currentUser);
      setMaxRating(scale.maxRating);
      setCycles(allCycles);
      let targetCycleId = selectedCycleId;
      if (cycleParam && allCycles.find((c) => c.id === cycleParam)) {
        targetCycleId = cycleParam;
      } else if (allCycles.length > 0 && !targetCycleId) {
        const active = allCycles.find((c) => c.status === 'ACTIVE');
        targetCycleId = active?.id || allCycles[0].id;
      }
      setSelectedCycleId(targetCycleId);
      if (targetCycleId) await loadScore(targetCycleId, currentUser.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadScore = async (cycleId: string, userId: string) => {
    try {
      setCalculating(true);
      setError('');
      const score = await calculateScore(cycleId, userId);
      setScoreData(score);
    } catch (err: any) {
      setError(err.message || 'Failed to load scores');
      setScoreData(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    router.push(`/employee/scores?cycleId=${cycleId}`);
    if (user) loadScore(cycleId, user.id);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-11 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 lg:col-span-5 h-56" />
          <div className="col-span-12 lg:col-span-7 grid grid-cols-3 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // If data failed to load, show a recoverable error instead of a blank page
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-on-surface-variant text-center max-w-sm">
          {error || 'Could not load scores. Please check your connection and try again.'}
        </p>
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
  const isLocked = !scoreData || scoreData.overall_score === null || scoreData.warnings?.length > 0;
  const cycleEndDate = selectedCycle?.endDate
    ? new Date(selectedCycle.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const questions = scoreData?.by_question ?? [];

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => router.push('/employee')}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 hover:bg-primary/15 dark:bg-primary/10 dark:hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors mb-3"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface font-display">My Performance Scores</h1>
        </div>
        <div className="relative shrink-0">
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="appearance-none bg-surface-container-lowest dark:bg-[#131b2e] border-none rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-on-surface shadow-sm focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Icon name="keyboard_arrow_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Locked banner — only show after fetch completes, not during initial load */}
      {isLocked && !calculating && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-xl shrink-0">
            <Icon name="lock" fill className="text-amber-800 dark:text-amber-400 text-[20px]" />
          </div>
          <div>
            <p className="text-amber-900 dark:text-amber-300 font-semibold text-sm">Scores are currently locked.</p>
            <p className="text-amber-700 dark:text-amber-400 text-sm">
              {cycleEndDate
                ? `Results will be revealed once the review cycle is officially complete on ${cycleEndDate}.`
                : 'Results will be revealed once all reviews in this cycle are complete.'}
            </p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {calculating && (
        <div className="mb-8 flex items-center gap-3 text-on-surface-variant">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          <span className="text-sm">Loading scores...</span>
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6 mb-8">

        {/* Hero overall score */}
        <div className="col-span-12 lg:col-span-5 relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br from-[#6d567f] to-[#422d53] text-white shadow-lg min-h-[220px] flex flex-col">
          <div className="flex justify-between items-start mb-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-purple-200 opacity-80">Overall Rating</span>
            <Icon name={isLocked ? 'lock_clock' : 'verified'} fill={!isLocked} className="text-[28px] opacity-50" />
          </div>
          <div className="mt-8">
            {isLocked ? (
              <>
                <h3 className="font-display text-5xl font-black mb-1">
                  N/A <span className="text-2xl text-purple-300 opacity-60">/ {maxRating}.0</span>
                </h3>
                <p className="text-base font-medium text-purple-200">Scores Locked</p>
              </>
            ) : (
              <>
                <h3 className="font-display text-5xl font-black mb-1">
                  {scoreData!.overall_score!.toFixed(2)}
                  <span className="text-2xl text-purple-300 opacity-60"> / {maxRating}.0</span>
                </h3>
                <p className="text-base font-medium text-purple-200">Overall Performance</p>
              </>
            )}
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Sub-score cards */}
        <div className="col-span-12 lg:col-span-7 grid grid-cols-3 gap-6">
          {/* Self */}
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Icon name="person" className="text-on-surface-variant text-[28px] mb-3" />
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-4">Self Review</p>
            <p className="text-3xl font-black text-on-surface mb-2">
              {isLocked ? 'N/A' : (scoreData!.breakdown.self?.toFixed(2) ?? 'N/A')}
            </p>
            {isLocked ? (
              <div className="flex items-center gap-1 text-on-surface-variant opacity-60">
                <Icon name="lock" className="text-[14px]" />
                <span className="text-[10px] font-bold">LOCKED</span>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">out of {maxRating}.0</p>
            )}
          </div>

          {/* Manager */}
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Icon name="badge" className="text-on-surface-variant text-[28px] mb-3" />
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-4">Manager Avg</p>
            <p className="text-3xl font-black text-on-surface mb-2">
              {isLocked ? 'N/A' : (scoreData!.breakdown.manager?.toFixed(2) ?? 'N/A')}
            </p>
            {isLocked ? (
              <div className="flex items-center gap-1 text-on-surface-variant opacity-60">
                <Icon name="lock" className="text-[14px]" />
                <span className="text-[10px] font-bold">LOCKED</span>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">
                {scoreData!.review_counts.manager_reviews} review{scoreData!.review_counts.manager_reviews !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Peer */}
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <Icon name="groups" className="text-on-surface-variant text-[28px] mb-3" />
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-4">Peer Average</p>
            <p className="text-3xl font-black text-on-surface mb-2">
              {isLocked ? 'N/A' : (scoreData!.breakdown.peer?.toFixed(2) ?? 'N/A')}
            </p>
            {isLocked ? (
              <div className="flex items-center gap-1 text-on-surface-variant opacity-60">
                <Icon name="lock" className="text-[14px]" />
                <span className="text-[10px] font-bold">LOCKED</span>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">
                {scoreData!.review_counts.peer_reviews} review{scoreData!.review_counts.peer_reviews !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Question breakdown table */}
      <section className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-surface-container-high dark:border-white/[0.04] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h4 className="font-display font-bold text-on-surface">Detailed Question Breakdown</h4>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="info" className="text-[16px]" />
            <span className="text-xs">Individual feedback will remain anonymous.</span>
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 dark:bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Question</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Self</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Manager Avg</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Peer Avg</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high dark:divide-white/[0.04]">
                {questions.map((q, idx) => (
                  <tr key={q.questionId} className="hover:bg-surface-container-low dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-5 max-w-sm">
                      <p className="text-sm font-semibold text-on-surface">{idx + 1}. {q.questionText}</p>
                    </td>
                    <td className="px-6 py-5 text-center text-sm text-on-surface-variant font-medium">
                      {isLocked ? '–' : (q.selfScore?.toFixed(1) ?? '–')}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {isLocked
                        ? <Icon name="lock" className="text-on-surface-variant opacity-40 text-[18px]" />
                        : <span className="text-sm text-on-surface-variant">{q.managerAvg?.toFixed(2) ?? '–'}</span>
                      }
                    </td>
                    <td className="px-6 py-5 text-center">
                      {isLocked
                        ? <Icon name="lock" className="text-on-surface-variant opacity-40 text-[18px]" />
                        : <span className="text-sm text-on-surface-variant">{q.peerAvg?.toFixed(2) ?? '–'}</span>
                      }
                    </td>
                    <td className="px-6 py-5 text-center">
                      {isLocked
                        ? <span className="inline-block px-3 py-1 bg-surface-container-high dark:bg-[#222a3d] rounded-full text-[10px] font-bold text-on-surface-variant">LOCKED</span>
                        : <span className="text-sm font-semibold text-on-surface">{q.overallAvg?.toFixed(2) ?? '–'}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Table footer — always shown when locked */}
        {isLocked && (
          <div className="p-10 text-center bg-surface-container-low/20 dark:bg-white/[0.01]">
            <div className="max-w-sm mx-auto">
              <div className="w-12 h-12 bg-surface-container-high dark:bg-[#222a3d] rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="lock_reset" className="text-primary text-[22px]" />
              </div>
              <h5 className="text-on-surface font-bold mb-1">Awaiting Cycle Completion</h5>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Detailed scores and feedback will be released once all reviews in this cycle are submitted. Contact HR if you believe this is an error.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="flex-1" />

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-surface-container-high dark:border-white/[0.04] text-center">
        <p className="text-xs text-on-surface-variant">© 2026 Reviewly Performance Systems. All rights reserved.</p>
      </div>
    </div>
  );
}
