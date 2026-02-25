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

  // Managers: only MANAGER role, same dept if employee has one
  const managerOptions = availableUsers.filter(
    (u) =>
      u.role === 'MANAGER' &&
      (!employee.department || u.department === employee.department),
  );

  // Peers: non-managers only, same dept if employee has one
  const peerOptions = availableUsers.filter(
    (u) =>
      u.role === 'EMPLOYEE' &&
      (!employee.department || u.department === employee.department),
  );

  const hasValidAssignment =
    managerIds.length >= 1 && peerIds.length >= 3 && peerIds.length <= 5;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {employee.name}
          </h3>
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
            {localSaving ? 'Saving...' : 'Save'}
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
            placeholder="Select managers..."
          />
          {managerIds.length === 0 && (
            <p className="mt-1 text-xs text-red-600">
              At least one manager required
            </p>
          )}
        </div>

        {/* Peer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Peers (3-5) <span className="text-red-500">*</span>
          </label>
          <ReviewerMultiSelect
            selectedIds={peerIds}
            availableUsers={peerOptions}
            onChange={handlePeerChange}
            placeholder="Select peers..."
          />
          {(peerIds.length < 3 || peerIds.length > 5) && (
            <p className="mt-1 text-xs text-red-600">
              Must select 3-5 peers (currently {peerIds.length})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
