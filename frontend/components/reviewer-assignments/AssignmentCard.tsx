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

  const inDept = (u: User) =>
    !filterDeptId ||
    managerIds.includes(u.id) ||
    peerIds.includes(u.id) ||
    (u.departments ?? []).some((d) => d.id === filterDeptId);

  const managerOptions = availableUsers.filter(
    (u) => u.role === 'MANAGER' && inDept(u),
  );
  const peerOptions = availableUsers.filter(
    (u) => u.role === 'EMPLOYEE' && inDept(u),
  );

  const filterDeptName = availableDepartments.find((d) => d.id === filterDeptId)?.name ?? '';

  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">{employee.name}</h3>
          <p className="text-sm text-on-surface-variant">{employee.email}</p>
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
            disabled={localSaving || saving}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {localSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant">
        <span className="text-sm font-medium text-on-surface-variant whitespace-nowrap">
          Reviewers from:
        </span>
        <select
          value={filterDeptId}
          onChange={(e) => setFilterDeptId(e.target.value)}
          className="flex-1 border border-outline rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-surface-container-lowest"
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
            className="text-xs text-primary hover:text-primary whitespace-nowrap"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">
            Managers
          </label>
          <ReviewerMultiSelect
            selectedIds={managerIds}
            availableUsers={managerOptions}
            onChange={handleManagerChange}
            placeholder="Select managers…"
          />
          {managerOptions.length === 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">
              No managers{filterDeptName ? ` in ${filterDeptName}` : ''}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">
            Peers
          </label>
          <ReviewerMultiSelect
            selectedIds={peerIds}
            availableUsers={peerOptions}
            onChange={handlePeerChange}
            placeholder="Select peers…"
          />
          {peerOptions.length === 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">
              No peers{filterDeptName ? ` in ${filterDeptName}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}