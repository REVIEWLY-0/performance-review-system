'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import { usersApi, User } from '@/lib/api';
import {
  reviewerAssignmentsApi,
  EmployeeAssignments,
} from '@/lib/reviewer-assignments';
import AssignmentCard from '@/components/reviewer-assignments/AssignmentCard';
import BulkUploadModal from '@/components/reviewer-assignments/BulkUploadModal';
import AssignmentSummary from '@/components/reviewer-assignments/AssignmentSummary';
import BackButton from '@/components/BackButton';

export default function AssignReviewersPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<EmployeeAssignments[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [cycleData, usersData, assignmentsData] = await Promise.all([
        reviewCyclesApi.getOne(params.id),
        usersApi.getAll(),
        reviewerAssignmentsApi.getByCycle(params.id),
      ]);

      setCycle(cycleData);
      setAllUsers(usersData.data);
      setAssignments(assignmentsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async (
    employeeId: string,
    managerIds: string[],
    peerIds: string[],
  ) => {
    try {
      setSaving(true);
      setError('');

      const assignmentsDto = [
        ...managerIds.map((id) => ({
          reviewerId: id,
          reviewerType: 'MANAGER' as const,
        })),
        ...peerIds.map((id) => ({
          reviewerId: id,
          reviewerType: 'PEER' as const,
        })),
      ];

      await reviewerAssignmentsApi.upsertForEmployee({
        reviewCycleId: params.id,
        employeeId,
        assignments: assignmentsDto,
      });

      setSuccessMessage('Assignments saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Reload assignments
      const updatedAssignments = await reviewerAssignmentsApi.getByCycle(
        params.id,
      );
      setAssignments(updatedAssignments);
    } catch (err: any) {
      setError(err.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUploadSuccess = async () => {
    setShowBulkUpload(false);
    await loadData();
    setSuccessMessage('Bulk upload completed successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !cycle) {
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
      {/* Header */}
      <BackButton href="/admin/review-cycles" label="← Back to Review Cycles" />
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Assign Reviewers
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {cycle?.name} - Assign managers and peers for each employee
          </p>
        </div>
        <button
          onClick={() => setShowBulkUpload(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
        >
          📄 Bulk Upload (CSV)
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

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

      {/* Summary Stats */}
      <AssignmentSummary
        totalEmployees={allUsers.length}
        assignedEmployees={assignments.length}
      />

      {/* Assignment Cards */}
      <div className="mt-6 space-y-4">
        {allUsers.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No employees found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add employees to your company first before assigning reviewers.
            </p>
          </div>
        ) : (
          allUsers.map((employee) => {
            const existingAssignment = assignments.find(
              (a) => a.employee.id === employee.id,
            );

            return (
              <AssignmentCard
                key={employee.id}
                employee={employee}
                existingManagers={existingAssignment?.managers || []}
                existingPeers={existingAssignment?.peers || []}
                availableUsers={allUsers.filter((u) => u.id !== employee.id)}
                onSave={handleSaveAssignment}
                saving={saving}
              />
            );
          })
        )}
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUploadModal
          reviewCycleId={params.id}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={handleBulkUploadSuccess}
        />
      )}
    </div>
  );
}
