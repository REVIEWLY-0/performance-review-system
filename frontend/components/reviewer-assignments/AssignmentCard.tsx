'use client';

import { useState, useEffect, useMemo } from 'react';
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

  // Derive unique departments from all available users (new multi-dept model)
  const availableDepartments = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const u of availableUsers) {
      for (const d of u.departments ?? []) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          result.push(d);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [availableUsers]);

  // Default filter to the employee's first department
  const defaultDeptId = employee.departments?.[0]?.id ?? '';
  const [filterDeptId, setFilterDeptId] = useState(defaultDeptId);

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

  // Filter reviewers by selected department (using new departments array)
  const inDept = (u: User) =>
    !filterDeptId || (u.departments ?? []).some((d) => d.id === filterDeptId);

  const managerOptions = availableUsers.filter(
    (u) => u.role === 'MANAGER' && inDept(u),
  );
  const peerOptions = availableUsers.filter(
    (u) => u.role === 'EMPLOYEE' && inDept(u),
  );

  const hasValidAssignment = managerIds.length >= 1 && peerIds.length >= 1;
  const filterDeptName = availableDepartments.find((d) => d.id === filterDeptId)?.name ?? '';

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
          <p className="text-sm text-gray-500">{employee.email}</p>
          {/* Department pills */}
          {(employee.departments ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(employee.departments ?? []).map((d) => (
                <span
                  key={d.id}
                  className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 border border-indigo-100"
                >
                  {d.name}
                </span>
              ))}
            </div>
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
          value={filterDeptId}
          onChange={(e) => setFilterDeptId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        >
          <option value="">All departments</option>
          {availableDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {filterDeptId !== defaultDeptId && (
          <button
            type="button"
            onClick={() => setFilterDeptId(defaultDeptId)}
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
              No managers{filterDeptName ? ` in ${filterDeptName}` : ''}
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
              No peers{filterDeptName ? ` in ${filterDeptName}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
