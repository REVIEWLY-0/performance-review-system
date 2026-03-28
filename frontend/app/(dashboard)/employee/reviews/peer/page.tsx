'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { getEmployeesToReviewAsPeer, EmployeeToReview } from '@/lib/reviews';
import SkeletonTable from '@/components/skeletons/SkeletonTable';

export default function PeerReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleParam = searchParams.get('cycleId');

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    cycleParam || '',
  );
  const [employees, setEmployees] = useState<EmployeeToReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCycles();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      loadEmployees(selectedCycleId);
    }
  }, [selectedCycleId]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const { data: activeCycles } = await reviewCyclesApi.getAll('ACTIVE');
      setCycles(activeCycles);

      // If cycleId in query param, use it; otherwise use first cycle
      if (cycleParam && activeCycles.find((c) => c.id === cycleParam)) {
        setSelectedCycleId(cycleParam);
      } else if (activeCycles.length > 0 && !selectedCycleId) {
        setSelectedCycleId(activeCycles[0].id);
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
      // Surface the real error — don't silently show "No peers assigned"
      const msg = err.message || 'Failed to load peer assignments';
      setError(msg);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    router.push(`/employee/reviews/peer?cycleId=${cycleId}`);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      NOT_STARTED: 'bg-surface-container text-on-surface',
      DRAFT: 'bg-yellow-100 text-yellow-800',
      SUBMITTED: 'bg-green-100 text-green-800',
    };

    const labels = {
      NOT_STARTED: 'Not Started',
      DRAFT: 'In Progress',
      SUBMITTED: 'Submitted',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getCompletionStats = () => {
    const submitted = employees.filter((e) => e.reviewStatus === 'SUBMITTED')
      .length;
    const total = employees.length;
    return { submitted, total };
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-surface-container-high rounded w-32 mb-4" />
          <div className="h-7 bg-surface-container-high rounded w-48 mb-1" />
          <div className="h-4 bg-surface-container-high rounded w-64" />
        </div>
        <div className="mb-6 animate-pulse">
          <div className="h-4 bg-surface-container-high rounded w-24 mb-2" />
          <div className="h-10 bg-surface-container-high rounded w-80" />
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  const stats = getCompletionStats();

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/employee')}
          className="text-sm text-purple-600 hover:text-purple-800 mb-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-on-surface">Peer Reviews</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Review your assigned peers for the selected cycle
        </p>
      </div>

      {/* Cycle Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-on-surface-variant mb-2">
          Review Cycle
        </label>
        {cycles.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-700">
              No active review cycles found. Contact your admin to create one.
            </p>
          </div>
        ) : (
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="block w-full md:w-96 px-3 py-2 border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name} (
                {new Date(cycle.startDate).toLocaleDateString()} -{' '}
                {new Date(cycle.endDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Statistics Card */}
      {selectedCycleId && employees.length > 0 && (
        <div className="mb-6 bg-surface-container-lowest shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface-variant">
                Completion Status
              </p>
              <p className="mt-2 text-3xl font-bold text-on-surface">
                {stats.submitted} / {stats.total}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {stats.total > 0
                  ? Math.round((stats.submitted / stats.total) * 100)
                  : 0}
                % complete
              </p>
            </div>
            <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Loading Employees */}
      {loadingEmployees && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-on-surface-variant">Loading employees...</p>
          </div>
        </div>
      )}

      {/* Employees List */}
      {!loadingEmployees && selectedCycleId && (
        <div className="bg-surface-container-lowest shadow overflow-hidden sm:rounded-md">
          {employees.length === 0 && !error ? (
            <div className="text-center py-12 px-4">
              <svg
                className="mx-auto h-12 w-12 text-on-surface-variant"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-on-surface">
                No peers assigned
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                You haven't been assigned any peers to review for this cycle.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {employees.map((employee) => (
                <li key={employee.id}>
                  <div className="px-4 py-4 flex items-center sm:px-6 hover:bg-surface-container-low">
                    <div className="min-w-0 flex-1 flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-lg font-medium text-purple-600">
                            {employee.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 px-4">
                        <div>
                          <p className="text-sm font-medium text-purple-600 truncate">
                            {employee.name}
                          </p>
                          <p className="mt-1 text-sm text-on-surface-variant truncate">
                            {employee.email}
                          </p>
                        </div>
                      </div>
                      <div className="mr-4">
                        {getStatusBadge(employee.reviewStatus)}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() =>
                          router.push(
                            `/employee/reviews/peer/${employee.id}?cycleId=${selectedCycleId}`,
                          )
                        }
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      >
                        {employee.reviewStatus === 'SUBMITTED'
                          ? 'View Review'
                          : employee.reviewStatus === 'DRAFT'
                            ? 'Continue Review'
                            : 'Start Review'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
