'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CycleInsights,
  ReviewStatus,
  EmployeeInsight,
  ReviewType,
} from '@/lib/review-cycles';
import StatusBadge from './StatusBadge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function reviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case 'SUBMITTED': return 'Submitted';
    case 'DRAFT':     return 'In Progress';
    default:          return 'Pending';
  }
}

function ReviewPill({ status, overdue }: { status: ReviewStatus; overdue?: boolean }) {
  const cls =
    status === 'SUBMITTED'
      ? 'bg-green-100 text-green-800'
      : overdue
      ? 'bg-red-100 text-red-700'
      : status === 'DRAFT'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-surface-container text-on-surface-variant';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status === 'SUBMITTED' ? 'Submitted' : overdue ? 'Overdue' : reviewStatusLabel(status)}
    </span>
  );
}

function employeeCompletionStatus(emp: EmployeeInsight): 'COMPLETE' | 'IN_PROGRESS' | 'NOT_STARTED' {
  const all: ReviewStatus[] = [
    emp.selfReviewStatus,
    ...emp.managerReviews.map((r) => r.status),
    ...emp.peerReviews.map((r) => r.status),
  ];
  if (all.length > 0 && all.every((s) => s === 'SUBMITTED')) return 'COMPLETE';
  if (all.some((s) => s !== 'NOT_STARTED')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

/** Latest end date among steps of a given type; null if no such step exists. */
function stepDeadline(
  configs: CycleInsights['cycle']['reviewConfigs'],
  type: ReviewType,
): Date | null {
  const dates = configs
    .filter((c) => c.reviewType === type)
    .map((c) => new Date(c.endDate));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function isOverdue(deadline: Date | null): boolean {
  if (!deadline) return false;
  return deadline < new Date();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass,
  total,
}: {
  label: string;
  value: number;
  colorClass: string;
  total?: number;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant p-4">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
      {pct !== null && (
        <div className="mt-2">
          <div className="w-full bg-surface-container rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${colorClass.replace('text-', 'bg-')}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">{pct}%</p>
        </div>
      )}
    </div>
  );
}

// Show peer reviewer names with status pills; collapse to summary when > 3
const PEER_COLLAPSE_THRESHOLD = 3;

function PeerReviewsCell({
  peerReviews,
  overdue,
}: {
  peerReviews: Array<{ reviewer: { id: string; name: string }; status: ReviewStatus }>;
  overdue: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = peerReviews.length;
  const submitted = peerReviews.filter((r) => r.status === 'SUBMITTED').length;

  if (total === 0) return <span className="text-xs text-on-surface-variant">Not assigned</span>;

  const visible = expanded ? peerReviews : peerReviews.slice(0, PEER_COLLAPSE_THRESHOLD);
  const hasMore = total > PEER_COLLAPSE_THRESHOLD;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((r) => (
        <div key={r.reviewer.id} className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant truncate max-w-[110px]" title={r.reviewer.name}>
            {r.reviewer.name}
          </span>
          <ReviewPill status={r.status} overdue={overdue && r.status !== 'SUBMITTED'} />
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:text-primary text-left mt-0.5"
        >
          {expanded ? 'Show less' : `+${total - PEER_COLLAPSE_THRESHOLD} more (${submitted}/${total} submitted)`}
        </button>
      )}
      {!hasMore && (
        <span className="text-xs text-on-surface-variant">{submitted}/{total} submitted</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CycleInsightsPanel({
  cycleId,
  insights,
}: {
  cycleId: string;
  insights: CycleInsights;
}) {
  const router = useRouter();
  const { cycle, stats, employees } = insights;

  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETE' | 'IN_PROGRESS' | 'NOT_STARTED' | 'OVERDUE'>('ALL');
  const [search, setSearch] = useState('');

  // Step deadlines (latest per type)
  const selfDeadline    = useMemo(() => stepDeadline(cycle.reviewConfigs, 'SELF'),    [cycle]);
  const managerDeadline = useMemo(() => stepDeadline(cycle.reviewConfigs, 'MANAGER'), [cycle]);
  const peerDeadline    = useMemo(() => stepDeadline(cycle.reviewConfigs, 'PEER'),    [cycle]);

  const selfOverdue    = isOverdue(selfDeadline);
  const managerOverdue = isOverdue(managerDeadline);
  const peerOverdue    = isOverdue(peerDeadline);

  // Compute overdue employees: at least one review type is overdue AND not submitted
  const overdueEmployees = useMemo(() =>
    employees.filter((emp) => {
      if (selfOverdue && emp.selfReviewStatus !== 'SUBMITTED') return true;
      if (managerOverdue && emp.managerReviews.some((r) => r.status !== 'SUBMITTED')) return true;
      if (peerOverdue && emp.peerReviews.some((r) => r.status !== 'SUBMITTED')) return true;
      return false;
    }),
    [employees, selfOverdue, managerOverdue, peerOverdue],
  );

  // Unique sorted departments from the new multi-dept model
  const departments = useMemo(() =>
    Array.from(
      new Set(employees.flatMap((e) => (e.departments ?? []).map((d) => d.name))),
    ).sort(),
    [employees],
  );

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((emp) => {
      if (
        deptFilter !== 'ALL' &&
        !(emp.departments ?? []).some((d) => d.name === deptFilter)
      ) return false;
      const compStatus = employeeCompletionStatus(emp);
      if (statusFilter === 'OVERDUE') {
        if (!overdueEmployees.includes(emp)) return false;
      } else if (statusFilter !== 'ALL' && compStatus !== statusFilter) {
        return false;
      }
      if (q && !emp.name.toLowerCase().includes(q) && !emp.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, deptFilter, statusFilter, search, overdueEmployees]);

  const isFiltered = deptFilter !== 'ALL' || statusFilter !== 'ALL' || search !== '';

  // Step names for display
  const stepsSummary = cycle.reviewConfigs
    .map((c) => c.name || c.reviewType)
    .join(' → ');

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center space-x-1 text-sm text-on-surface-variant">
        <button
          onClick={() => router.push('/admin')}
          className="hover:text-indigo-600 transition-colors"
        >
          Dashboard
        </button>
        <span className="text-outline">/</span>
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="hover:text-indigo-600 transition-colors"
        >
          Review Cycles
        </button>
        <span className="text-outline">/</span>
        <span className="text-on-surface font-medium truncate max-w-[240px]">
          {cycle.name}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-on-surface">{cycle.name}</h1>
          <StatusBadge status={cycle.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/review-cycles/${cycleId}/assign-reviewers`)}
            className="inline-flex items-center px-3 py-2 border border-outline text-sm font-medium rounded-md text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
          >
            <svg className="mr-1.5 h-4 w-4 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Assign Reviewers
          </button>
          <button
            onClick={() => router.push(`/admin/cycles/${cycleId}/scores`)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dim transition-colors"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Scores
          </button>
        </div>
      </div>

      {/* Cycle meta */}
      <div className="mb-6 bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-on-surface-variant">
        <span>
          <span className="font-medium text-on-surface">Period: </span>
          {new Date(cycle.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' – '}
          {new Date(cycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span>
          <span className="font-medium text-on-surface">Steps: </span>
          {stepsSummary}
        </span>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Total Employees" value={stats.total} colorClass="text-on-surface" />
        <StatCard label="Fully Complete" value={stats.fullyComplete} colorClass="text-green-600" total={stats.total} />
        <StatCard label="In Progress"    value={stats.inProgress}   colorClass="text-yellow-600" total={stats.total} />
        <StatCard label="Not Started"    value={stats.notStarted}   colorClass="text-red-500" total={stats.total} />
        <StatCard label="Overdue"        value={overdueEmployees.length} colorClass="text-orange-600" total={stats.total} />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="block pl-9 pr-3 py-2 border border-outline rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="block px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        >
          <option value="ALL">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="block px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        >
          <option value="ALL">All statuses</option>
          <option value="COMPLETE">Complete</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="OVERDUE">Overdue</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => { setDeptFilter('ALL'); setStatusFilter('ALL'); setSearch(''); }}
            className="text-sm text-primary hover:text-primary"
          >
            Clear filters
          </button>
        )}

        {isFiltered && (
          <span className="text-xs text-on-surface-variant">
            {filtered.length} of {employees.length} employees
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest shadow rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant text-sm">
            {employees.length === 0
              ? 'No reviewer assignments have been created for this cycle yet.'
              : 'No employees match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Employee
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Self Review
                    {selfDeadline && (
                      <span className="ml-1 text-on-surface-variant normal-case font-normal">
                        (due {selfDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </span>
                    )}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Manager Review(s)
                    {managerDeadline && (
                      <span className="ml-1 text-on-surface-variant normal-case font-normal">
                        (due {managerDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </span>
                    )}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Peer Reviews
                    {peerDeadline && (
                      <span className="ml-1 text-on-surface-variant normal-case font-normal">
                        (due {peerDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface-container-lowest divide-y divide-outline-variant">
                {filtered.map((emp) => {
                  const completionStatus = employeeCompletionStatus(emp);
                  const empIsOverdue = overdueEmployees.includes(emp);
                  const rowBg =
                    completionStatus === 'COMPLETE'
                      ? 'bg-green-50/40'
                      : empIsOverdue
                      ? 'bg-orange-50/40'
                      : completionStatus === 'IN_PROGRESS'
                      ? 'bg-yellow-50/40'
                      : '';

                  const peerSubmitted = emp.peerReviews.filter((r) => r.status === 'SUBMITTED').length;
                  const peerTotal = emp.peerReviews.length;

                  return (
                    <tr key={emp.id} className={rowBg}>
                      {/* Employee */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm font-medium text-on-surface">{emp.name}</div>
                            <div className="text-xs text-on-surface-variant">{emp.email}</div>
                          </div>
                          {empIsOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3">
                        {(emp.departments ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(emp.departments ?? []).map((d) => (
                              <span
                                key={d.id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                              >
                                {d.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-outline">—</span>
                        )}
                      </td>

                      {/* Self Review */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ReviewPill
                          status={emp.selfReviewStatus}
                          overdue={selfOverdue && emp.selfReviewStatus !== 'SUBMITTED'}
                        />
                      </td>

                      {/* Manager Reviews */}
                      <td className="px-4 py-3">
                        {emp.managerReviews.length === 0 ? (
                          <span className="text-xs text-on-surface-variant">Not assigned</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {emp.managerReviews.map((r) => (
                              <div key={r.reviewer.id} className="flex items-center gap-2">
                                <span className="text-xs text-on-surface-variant truncate max-w-[120px]" title={r.reviewer.name}>
                                  {r.reviewer.name}
                                </span>
                                <ReviewPill
                                  status={r.status}
                                  overdue={managerOverdue && r.status !== 'SUBMITTED'}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Peer Reviews */}
                      <td className="px-4 py-3">
                        <PeerReviewsCell
                          peerReviews={emp.peerReviews}
                          overdue={peerOverdue}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
