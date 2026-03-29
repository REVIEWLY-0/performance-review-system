'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getEmployeesToReviewAsPeer, EmployeeToReview } from '@/lib/reviews';

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

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
];

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-surface-container-high dark:bg-[#1e293b] rounded-2xl ${className}`} />
  );
}

export default function PeerReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleParam = searchParams.get('cycleId');

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycleParam || '');
  const [employees, setEmployees] = useState<EmployeeToReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadCycles(); }, []);

  useEffect(() => {
    if (selectedCycleId) loadEmployees(selectedCycleId);
  }, [selectedCycleId]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const { data: allCycles } = await reviewCyclesApi.getAll();
      setCycles(allCycles);
      const activeCycle = allCycles.find((c) => c.status === 'ACTIVE');
      if (cycleParam && allCycles.find((c) => c.id === cycleParam)) {
        setSelectedCycleId(cycleParam);
      } else if (activeCycle && !selectedCycleId) {
        setSelectedCycleId(activeCycle.id);
      } else if (allCycles.length > 0 && !selectedCycleId) {
        setSelectedCycleId(allCycles[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load review cycles');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async (cycleId: string) => {
    try {
      setLoadingEmployees(true);
      setError('');
      const employeeList = await getEmployeesToReviewAsPeer(cycleId);
      setEmployees(employeeList);
    } catch (err: any) {
      setError(err.message || 'Failed to load peer assignments');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    router.push(`/employee/reviews/peer?cycleId=${cycleId}`);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-5 w-28 mb-6" />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-14 w-52" />
        </div>
        <Skeleton className="h-36 w-full mb-10" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  const submitted = employees.filter((e) => e.reviewStatus === 'SUBMITTED').length;
  const total = employees.length;
  const pending = total - submitted;
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const cycleStatus = selectedCycle?.status;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/employee/reviews')}
        className="flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors mb-6"
      >
        <Icon name="chevron_left" className="text-[18px]" />
        My Reviews
      </button>

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-on-surface font-display">Peer Reviews</h1>
          <p className="text-sm text-on-surface-variant">Review your assigned peers for the selected cycle</p>
        </div>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">Review Cycle</label>
          <div className="relative">
            <select
              value={selectedCycleId}
              onChange={(e) => handleCycleChange(e.target.value)}
              className="w-full appearance-none bg-surface-container-lowest dark:bg-[#131b2e] border-none rounded-xl px-4 py-3 pr-10 text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20 cursor-pointer text-on-surface"
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
              ))}
            </select>
            <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl px-5 py-4">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Completion stat card */}
      {loadingEmployees ? (
        <Skeleton className="h-36 w-full mb-10" />
      ) : (
        <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-8 mb-10">
          {/* Cycle status pill — only shown if status is meaningful */}
          {cycleStatus === 'ACTIVE' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Active Cycle
            </div>
          )}
          {cycleStatus === 'COMPLETED' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-high dark:bg-[#222a3d] text-on-surface-variant rounded-full text-xs font-semibold mb-4">
              <Icon name="check" className="text-[12px]" />
              Cycle Completed
            </div>
          )}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-6xl md:text-7xl font-medium text-on-surface tracking-tight">{submitted}/{total}</span>
            <span className="text-xl font-normal text-on-surface-variant">complete</span>
          </div>
          <p className="text-base text-on-surface-variant mt-2">
            {pending > 0
              ? `You have ${pending} pending peer review${pending !== 1 ? 's' : ''} to submit.`
              : 'All peer reviews submitted — great work!'}
          </p>
        </div>
      )}

      {/* Peer list */}
      <div className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-on-surface tracking-tight font-display">Assigned Peers</h2>
          <span className="text-sm text-on-surface-variant">{total} Peer{total !== 1 ? 's' : ''}</span>
        </div>

        {loadingEmployees ? (
          <div className="grid grid-cols-1 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-16 flex flex-col items-center text-center">
            <Icon name="group_off" className="text-[44px] text-on-surface-variant mb-3" />
            <p className="font-semibold text-on-surface">No peers assigned</p>
            <p className="text-sm text-on-surface-variant mt-1">You haven't been assigned any peers for this cycle.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {employees.map((employee, i) => {
              const initials = employee.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const isDraft = employee.reviewStatus === 'DRAFT';
              const isSubmitted = employee.reviewStatus === 'SUBMITTED';
              const dotColor = isSubmitted ? 'bg-green-500' : isDraft ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600';
              return (
                <div
                  key={employee.id}
                  className="bg-surface-container-lowest dark:bg-[#131b2e] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-5 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-none transition-all duration-300 group border border-transparent dark:border-transparent"
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative shrink-0">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg font-display group-hover:rotate-3 transition-transform ${avatarColor}`}>
                        {initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-surface-container-lowest dark:bg-[#131b2e] rounded-full p-0.5">
                        <div className={`w-full h-full rounded-full ${dotColor}`} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-on-surface leading-tight">{employee.name}</h3>
                      <p className="text-sm text-on-surface-variant">{employee.email}</p>
                      {employee.department && (
                        <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider bg-surface-container-high dark:bg-[#222a3d] px-2 py-0.5 rounded text-on-surface-variant">
                          {employee.department}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: status + button */}
                  <div className="flex flex-row items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-center sm:items-end gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Status</span>
                      {isSubmitted ? (
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold text-sm bg-green-100 dark:bg-green-900/30 px-4 py-1.5 rounded-full whitespace-nowrap">
                          <Icon name="check_circle" fill className="text-[15px]" /> Submitted
                        </div>
                      ) : isDraft ? (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-sm bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 rounded-full whitespace-nowrap">
                          <Icon name="edit" className="text-[15px]" /> In Progress
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-on-surface-variant font-semibold text-sm bg-surface-container-high dark:bg-[#222a3d] px-4 py-1.5 rounded-full whitespace-nowrap">
                          <Icon name="more_horiz" className="text-[15px]" /> Not Started
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/employee/reviews/peer/${employee.id}?cycleId=${selectedCycleId}`)}
                      className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 active:scale-95 transition-all whitespace-nowrap ${
                        isSubmitted
                          ? 'bg-surface-container-high dark:bg-[#222a3d] text-on-surface hover:bg-surface-container-highest dark:hover:bg-[#2d3449]'
                          : 'bg-primary hover:bg-primary-dim text-on-primary shadow-md shadow-primary/15'
                      }`}
                    >
                      {isSubmitted ? 'View' : isDraft ? 'Continue' : 'Start'}
                      <Icon name="arrow_forward" className="text-[15px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-surface-container-high dark:border-white/[0.04] text-center">
        <p className="text-xs text-on-surface-variant">© 2026 Reviewly Performance Systems. All rights reserved.</p>
      </div>
    </div>
  );
}
