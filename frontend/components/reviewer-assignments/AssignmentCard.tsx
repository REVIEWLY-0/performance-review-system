'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/api';
import ReviewerMultiSelect from './ReviewerMultiSelect';

interface AssignmentCardProps {
  employee: User;
  existingManagers: Array<{ id: string; name: string }>;
  existingPeers: Array<{ id: string; name: string }>;
  availableUsers: User[];
  onSave: (
    employeeId: string,
    managerIds: string[],
    peerIds: string[],
  ) => Promise<void>;
  saving: boolean;
}

export default function AssignmentCard({
  employee,
  existingManagers,
  existingPeers,
  availableUsers,
  onSave,
  saving,
}: AssignmentCardProps) {
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);

  // Department filter — defaults to employee's department (which is always set)
  const [filterDept, setFilterDept] = useState(employee.department || '');

  // Derive distinct departments from all available users
  const availableDepartments = [
    ...new Set(availableUsers.map((u) => u.department).filter(Boolean)),
  ].sort() as string[];

  useEffect(() => {
    setManagerIds(existingManagers.map((m) => m.id));
    setPeerIds(existingPeers.map((p) => p.id));
    setIsDirty(false);
  }, [existingManagers, existingPeers]);

  const handleSave = async () => {
    setLocalSaving(true);
    try {
      await onSave(employee.id, managerIds, peerIds);
      setIsDirty(false);
    } finally {
      setLocalSaving(false);
    }
  };

  const handleManagerChange = (ids: string[]) => {
    setManagerIds(ids);
    setIsDirty(true);
  };

  const handlePeerChange = (ids: string[]) => {
    setPeerIds(ids);
    setIsDirty(true);
  };

  // Reviewers filtered by selected department
  // Managers: MANAGER role only, from filterDept
  const managerOptions = availableUsers.filter(
    (u) => u.role === 'MANAGER' && u.department === filterDept,
  );

  // Peers: EMPLOYEE role only, from filterDept (managers cannot be peers)
  const peerOptions = availableUsers.filter(
    (u) => u.role === 'EMPLOYEE' && u.department === filterDept,
  );

  const hasValidAssignment = managerIds.length >= 1 && peerIds.length >= 1;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
          <p className="text-sm text-gray-500">{employee.email}</p>
          {employee.department && (
            <span className="mt-1 inline-block text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5">
              {employee.department}
            </span>
          )}
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={!hasValidAssignment || localSaving || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {localSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {/* Department filter — step 1: select department */}
      <div className="mb-5 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Reviewers from:
        </span>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        >
          {availableDepartments.length === 0 ? (
            <option value="">(no departments)</option>
          ) : (
            availableDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))
          )}
        </select>
        {filterDept !== employee.department && (
          <button
            type="button"
            onClick={() => setFilterDept(employee.department || '')}
            className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manager Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Managers (1+) <span className="text-red-500">*</span>
          </label>
          <ReviewerMultiSelect
            selectedIds={managerIds}
            availableUsers={managerOptions}
            onChange={handleManagerChange}
            placeholder="Select managers…"
          />
          {managerIds.length === 0 && (
            <p className="mt-1 text-xs text-red-600">
              At least one manager required
            </p>
          )}
          {managerOptions.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              No managers in {filterDept}
            </p>
          )}
        </div>

        {/* Peer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Peers (1+) <span className="text-red-500">*</span>
          </label>
          <ReviewerMultiSelect
            selectedIds={peerIds}
            availableUsers={peerOptions}
            onChange={handlePeerChange}
            placeholder="Select peers…"
          />
          {peerIds.length === 0 && (
            <p className="mt-1 text-xs text-red-600">
              At least one peer required
            </p>
          )}
          {peerOptions.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              No peers in {filterDept}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
