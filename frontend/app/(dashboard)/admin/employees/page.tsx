'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';
import { usersApi, UserStats } from '@/lib/api';
import EmployeeList from '@/components/employees/EmployeeList';
import CreateEmployeeButton from '@/components/employees/CreateEmployeeButton';
import CsvImportModal from '@/components/employees/CsvImportModal';
import BackButton from '@/components/BackButton';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonTable from '@/components/skeletons/SkeletonTable';
import Pagination from '@/components/Pagination';

function downloadCsvTemplate() {
  const headers = ['name', 'email', 'role', 'department', 'manager_email'];
  const sample = ['Jane Smith', 'jane.smith@company.com', 'EMPLOYEE', 'Engineering', 'manager@company.com'];
  const csv = [headers.join(','), sample.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'employee_import_template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function EmployeesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    byRole: { admins: 0, managers: 0, employees: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE'>('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        console.log('📋 Employees page: Loading data...');

        // Check auth
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          console.log('⚠️  No user, redirecting to login');
          const { signOut } = await import('@/lib/auth');
          await signOut();
          router.push('/login');
          return;
        }

        if (currentUser.role !== 'ADMIN') {
          console.log('⚠️  Not admin, redirecting');
          router.push('/employee');
          return;
        }

        console.log('✅ User authenticated:', currentUser.email);
        setUser(currentUser);

        // Fetch data
        console.log('📡 Fetching employees and stats...');
        const [employeesResponse, statsData] = await Promise.all([
          usersApi.getAll(1, 50),
          usersApi.getStats(),
        ]);

        console.log('✅ Data loaded:', {
          employees: employeesResponse.data.length,
          stats: statsData.total,
        });

        setEmployees(employeesResponse.data);
        setTotalPages(employeesResponse.pagination.totalPages);
        setStats(statsData);
      } catch (err: any) {
        console.error('❌ Error loading employees page:', err);
        setError(err.message || 'Failed to load data');
        // On error, don't redirect - just show error
        // The fetchWithAuth will handle 401 automatically
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handlePageChange = async (newPage: number) => {
    setPage(newPage);
    try {
      const response = await usersApi.getAll(newPage, 50);
      setEmployees(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="mt-2 h-4 bg-gray-200 rounded w-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <BackButton href="/admin" label="← Back to Dashboard" />
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your company's employees and their roles
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={downloadCsvTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <CreateEmployeeButton onCreated={() => handlePageChange(page)} />
        </div>
      </div>

      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            handlePageChange(page);
          }}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Employees
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Admins</dt>
                  <dd className="text-lg font-semibold text-gray-900">{stats.byRole.admins}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Managers</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {stats.byRole.managers}
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
                <svg
                  className="h-6 w-6 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Employees</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {stats.byRole.employees}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      {(() => {
        const isFiltered = search !== '' || roleFilter !== 'ALL';
        const filteredEmployees = employees.filter(emp => {
          const matchesSearch =
            !search ||
            emp.name.toLowerCase().includes(search.toLowerCase()) ||
            emp.email.toLowerCase().includes(search.toLowerCase());
          const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;
          return matchesSearch && matchesRole;
        });

        return (
          <>
            <div className="mb-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
                className="block w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
              {isFiltered && (
                <button
                  onClick={() => { setSearch(''); setRoleFilter('ALL'); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                >
                  Clear filters
                </button>
              )}
            </div>

            {isFiltered && (
              <p className="text-xs text-gray-500 mb-2">
                {filteredEmployees.length === 0
                  ? 'No employees match your filters on this page'
                  : `Showing ${filteredEmployees.length} of ${employees.length} on this page`}
              </p>
            )}

            <EmployeeList employees={filteredEmployees} />
            {!isFiltered && (
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
            )}
          </>
        );
      })()}
    </div>
  );
}
