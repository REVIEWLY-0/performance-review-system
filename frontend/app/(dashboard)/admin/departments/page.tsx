'use client';

import { useEffect, useState } from 'react';
import BackButton from '@/components/BackButton';
import { Department, departmentsApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DepartmentsPage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [archived, setArchived] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [active, arch] = await Promise.all([
        departmentsApi.getAll(),
        departmentsApi.getArchived(),
      ]);
      setDepartments(active);
      setArchived(arch);
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const dept = await departmentsApi.create(formName.trim());
      setDepartments((prev) =>
        [...prev, dept].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormName('');
      setShowForm(false);
      toast.success(`"${dept.name}" created`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await departmentsApi.update(id, editName.trim());
      setDepartments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setEditingId(null);
      toast.success('Department renamed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename department');
    }
  };

  const handleArchive = (dept: Department) => {
    setConfirmDialog({
      title: 'Archive Department',
      message: `Archive "${dept.name}"? It won't be available for new assignments, but existing data is preserved.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const updated = await departmentsApi.archive(dept.id);
          setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
          setArchived((prev) => [...prev, updated]);
          setConfirmDialog(null);
          toast.success(`"${dept.name}" archived`);
        } catch (err: any) {
          setConfirmDialog(null);
          toast.error(err.message || 'Failed to archive department');
        }
      },
    });
  };

  const handleRestore = async (dept: Department) => {
    try {
      const updated = await departmentsApi.restore(dept.id);
      setArchived((prev) => prev.filter((d) => d.id !== dept.id));
      setDepartments((prev) =>
        [...prev, updated].sort((a, b) => a.name.localeCompare(b.name)),
      );
      toast.success(`"${dept.name}" restored`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore department');
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <BackButton href="/admin" label="← Back to Dashboard" />
        <h1 className="text-2xl font-bold text-on-surface mt-2">Departments</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Manage departments for your company. Employees can belong to multiple departments.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Active departments */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              Active Departments
              {!loading && (
                <span className="ml-2 text-xs font-normal text-on-surface-variant">
                  ({departments.length})
                </span>
              )}
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Click a department pill to rename it. Hover to see actions.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dim"
            >
              + Add Department
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleCreate} className="mb-5 flex items-center gap-2">
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Department name (e.g. Engineering)"
              maxLength={100}
              autoFocus
              className="flex-1 px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
            <button
              type="submit"
              disabled={submitting || !formName.trim()}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dim disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormName('');
              }}
              className="px-3 py-2 border border-outline rounded-md text-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low"
            >
              Cancel
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-surface-container rounded-full" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant bg-surface-container-low rounded-lg">
            <p className="text-sm">No departments yet.</p>
            <p className="text-xs mt-1 text-on-surface-variant">
              Add departments to organize your employees.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) =>
              editingId === dept.id ? (
                /* Inline rename input */
                <span key={dept.id} className="inline-flex items-center gap-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(dept.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    maxLength={100}
                    autoFocus
                    className="px-3 py-1 text-sm border border-indigo-400 rounded-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(dept.id)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-on-surface-variant hover:text-on-surface text-sm"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                /* Department pill */
                <span
                  key={dept.id}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-full text-sm font-medium border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  <span>{dept.name}</span>
                  {dept._count != null && (
                    <span className="text-xs text-indigo-400 tabular-nums">
                      {dept._count.userDepts}
                    </span>
                  )}
                  {/* Rename button — shows on hover */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(dept.id);
                      setEditName(dept.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-indigo-400 hover:text-indigo-600 transition-opacity"
                    title="Rename"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Archive button — shows on hover */}
                  <button
                    type="button"
                    onClick={() => handleArchive(dept)}
                    className="opacity-0 group-hover:opacity-100 text-outline-variant hover:text-red-500 transition-opacity"
                    title="Archive"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12" />
                    </svg>
                  </button>
                </span>
              ),
            )}
          </div>
        )}
      </div>

      {/* Archived departments */}
      {(archived.length > 0 || !loading) && (
        <div className="mt-4 bg-surface-container-lowest shadow rounded-lg p-6">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Archived Departments ({archived.length})
          </button>

          {showArchived && archived.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {archived.map((dept) => (
                <span
                  key={dept.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-full text-sm border border-outline-variant"
                >
                  <span className="line-through">{dept.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRestore(dept)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 font-medium no-underline"
                    title="Restore department"
                  >
                    Restore
                  </button>
                </span>
              ))}
            </div>
          )}

          {showArchived && archived.length === 0 && (
            <p className="mt-3 text-sm text-on-surface-variant">No archived departments.</p>
          )}
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
