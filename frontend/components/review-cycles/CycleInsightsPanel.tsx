'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CycleInsights,
  ReviewStatus,
  EmployeeInsight,
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

function ReviewPill({ status }: { status: ReviewStatus }) {
  const cls =
    status === 'SUBMITTED'
      ? 'bg-green-100 text-green-800'
      : status === 'DRAFT'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {reviewStatusLabel(status)}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETE' | 'IN_PROGRESS' | 'NOT_STARTED'>('ALL');

  // Unique sorted departments
  const departments = Array.from(
    new Set(employees.map((e) => e.department ?? 'Unknown')),
  ).sort();

  // Filtered list
  const filtered = employees.filter((emp) => {
    if (deptFilter !== 'ALL' && (emp.department ?? 'Unknown') !== deptFilter)
      return false;
    if (statusFilter !== 'ALL' && employeeCompletionStatus(emp) !== statusFilter)
      return false;
    return true;
  });

  const isFiltered = deptFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center space-x-1 text-sm text-gray-500">
        <button
          onClick={() => router.push('/admin')}
          className="hover:text-indigo-600 transition-colors"
        >
          Dashboard
        </button>
        <span className="text-gray-300">/</span>
        <button
          onClick={() => router.push('/admin/review-cycles')}
          className="hover:text-indigo-600 transition-colors"
        >
          Review Cycles
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium truncate max-w-[240px]">
          {cycle.name}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{cycle.name}</h1>
          <StatusBadge status={cycle.status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/review-cycles/${cycleId}/assign-reviewers`)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Assign Reviewers
          </button>
          <button
            onClick={() => router.push(`/admin/cycles/${cycleId}/scores`)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
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
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
        <span>
          <span className="font-medium text-gray-900">Period: </span>
          {new Date(cycle.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' – '}
          {new Date(cycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span>
          <span className="font-medium text-gray-900">Steps: </span>
          {cycle.reviewConfigs.map((c) => c.reviewType).join(' → ')}
        </span>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={stats.total} colorClass="text-gray-900" />
        <StatCard label="Fully Complete" value={stats.fullyComplete} colorClass="text-green-600" />
        <StatCard label="In Progress" value={stats.inProgress} colorClass="text-yellow-600" />
        <StatCard label="Not Started" value={stats.notStarted} colorClass="text-red-500" />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-3 items-center">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="block px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="ALL">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="block px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="ALL">All statuses</option>
          <option value="COMPLETE">Complete</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="NOT_STARTED">Not Started</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => { setDeptFilter('ALL'); setStatusFilter('ALL'); }}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Clear filters
          </button>
        )}

        {isFiltered && (
          <span className="text-xs text-gray-500">
            {filtered.length} of {employees.length} employees
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            {employees.length === 0
              ? 'No reviewer assignments have been created for this cycle yet.'
              : 'No employees match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Self Review
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manager Review(s)
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peer Reviews
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((emp) => {
                  const completionStatus = employeeCompletionStatus(emp);
                  const rowBg =
                    completionStatus === 'COMPLETE'
                      ? 'bg-green-50/40'
                      : completionStatus === 'IN_PROGRESS'
                      ? 'bg-yellow-50/40'
                      : '';

                  const peerSubmitted = emp.peerReviews.filter((r) => r.status === 'SUBMITTED').length;
                  const peerTotal = emp.peerReviews.length;

                  return (
                    <tr key={emp.id} className={rowBg}>
                      {/* Employee */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-400">{emp.email}</div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {emp.department ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Self Review */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ReviewPill status={emp.selfReviewStatus} />
                      </td>

                      {/* Manager Reviews */}
                      <td className="px-4 py-3">
                        {emp.managerReviews.length === 0 ? (
                          <span className="text-xs text-gray-400">Not assigned</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {emp.managerReviews.map((r) => (
                              <div key={r.reviewer.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 truncate max-w-[120px]" title={r.reviewer.name}>
                                  {r.reviewer.name}
                                </span>
                                <ReviewPill status={r.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Peer Reviews */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {peerTotal === 0 ? (
                          <span className="text-xs text-gray-400">Not assigned</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                peerSubmitted === peerTotal
                                  ? 'text-green-700'
                                  : peerSubmitted > 0
                                  ? 'text-yellow-700'
                                  : 'text-gray-500'
                              }`}
                            >
                              {peerSubmitted}/{peerTotal}
                            </span>
                            <span className="text-xs text-gray-400">submitted</span>
                          </div>
                        )}
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
