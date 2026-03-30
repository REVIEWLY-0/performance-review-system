'use client';

import { useEffect, useState } from 'react';
import BackButton from '@/components/BackButton';
import {
  ReviewTypeConfig,
  reviewTypeConfigsApi,
  CreateReviewTypeConfigDto,
  BaseReviewType,
} from '@/lib/review-type-configs';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

const BASE_TYPE_LABELS: Record<BaseReviewType, string> = {
  SELF: 'Self (employee reviews themselves)',
  MANAGER: 'Manager (manager reviews an employee)',
  PEER: 'Peer (colleague reviews an employee)',
};

const BASE_TYPE_COLORS: Record<BaseReviewType, string> = {
  SELF: 'bg-blue-100 text-blue-800',
  MANAGER: 'bg-green-100 text-green-800',
  PEER: 'bg-purple-100 text-purple-800',
};

function RequiredToggle({
  config,
  onToggle,
}: {
  config: ReviewTypeConfig;
  onToggle: (id: string, isRequired: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const handleClick = async () => {
    setToggling(true);
    await onToggle(config.id, !config.isRequired);
    setToggling(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={toggling}
      title={config.isRequired ? 'Click to make optional' : 'Click to make required'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
        config.isRequired ? 'bg-primary' : 'bg-outline'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          config.isRequired ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function ReviewTypesPage() {
  const toast = useToast();

  const [configs, setConfigs] = useState<ReviewTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formBaseType, setFormBaseType] = useState<BaseReviewType>('PEER');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await reviewTypeConfigsApi.getAll();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load review types');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequired = async (id: string, isRequired: boolean) => {
    try {
      const updated = await reviewTypeConfigsApi.update(id, { isRequired });
      setConfigs((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success(isRequired ? 'Marked as required' : 'Marked as optional');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setFormError('Label is required');
      return;
    }

    setFormError('');
    setSubmitting(true);
    try {
      const dto: CreateReviewTypeConfigDto = {
        label: formLabel.trim(),
        baseType: formBaseType,
      };
      const newConfig = await reviewTypeConfigsApi.create(dto);
      setConfigs((prev) => [...prev, newConfig]);
      setShowForm(false);
      setFormLabel('');
      setFormBaseType('PEER');
      toast.success(`"${newConfig.label}" review type created`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create review type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (config: ReviewTypeConfig) => {
    setConfirmDialog({
      title: 'Delete Review Type',
      message: `Delete "${config.label}"? This will not affect existing cycles using this type.`,
      variant: 'danger',
      onConfirm: async () => {
        setDeletingId(config.id);
        try {
          await reviewTypeConfigsApi.delete(config.id);
          setConfigs((prev) => prev.filter((c) => c.id !== config.id));
          setConfirmDialog(null);
          toast.success(`"${config.label}" deleted`);
        } catch (err: any) {
          setConfirmDialog(null);
          toast.error(err.message || 'Failed to delete review type');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const builtIns = configs.filter((c) => c.isBuiltIn);
  const custom = configs.filter((c) => !c.isBuiltIn);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <BackButton href="/admin" label="← Back to Dashboard" />
        <h1 className="text-2xl font-bold text-on-surface mt-2">Review Types</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Manage the reviewer roles available in your workflow steps. Toggle{' '}
          <strong>Required</strong> to control whether a type must be completed before an
          employee&apos;s score is shown.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest shadow rounded-lg p-5 h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Built-in types */}
          <div className="bg-surface-container-lowest shadow rounded-lg p-6">
            <h2 className="text-base font-semibold text-on-surface mb-1">Built-in Types</h2>
            <p className="text-sm text-on-surface-variant mb-4">
              These types are always available. You can change whether they are required.
            </p>
            <div className="divide-y divide-outline-variant">
              {builtIns.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-on-surface">{config.label}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BASE_TYPE_COLORS[config.baseType]}`}
                    >
                      {config.baseType}
                    </span>
                    {config.isRequired && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-on-surface-variant">
                      {config.isRequired ? 'Required' : 'Optional'}
                    </span>
                    <RequiredToggle config={config} onToggle={handleToggleRequired} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score gate explanation */}
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
            <strong>How &quot;Required&quot; works:</strong> An employee&apos;s score is hidden
            until all <em>required</em> review types that have been assigned to them are
            submitted. Optional types (e.g. peer reviews) will not block the score if they
            haven&apos;t been submitted.
          </div>

          {/* Custom types */}
          <div className="bg-surface-container-lowest shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Custom Types</h2>
                <p className="text-sm text-on-surface-variant">
                  {custom.length === 0
                    ? 'No custom types yet.'
                    : `${custom.length} custom type${custom.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dim"
                >
                  + Add Custom Type
                </button>
              )}
            </div>

            {/* Add form */}
            {showForm && (
              <form
                onSubmit={handleCreate}
                className="mb-4 p-4 border border-indigo-200 rounded-lg bg-indigo-50 space-y-3"
              >
                <h3 className="text-sm font-semibold text-indigo-900">New Custom Review Type</h3>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="e.g. Lead Review, Mentor Feedback, 360 Review"
                    maxLength={80}
                    className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Base Behavior <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formBaseType}
                    onChange={(e) => setFormBaseType(e.target.value as BaseReviewType)}
                    className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    {(['SELF', 'MANAGER', 'PEER'] as BaseReviewType[]).map((bt) => (
                      <option key={bt} value={bt}>
                        {BASE_TYPE_LABELS[bt]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Determines how this review type behaves in the system.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dim disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormLabel('');
                      setFormError('');
                    }}
                    className="px-4 py-2 border border-outline rounded-md text-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Custom types list */}
            {custom.length > 0 && (
              <div className="divide-y divide-outline-variant">
                {custom.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-on-surface">{config.label}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BASE_TYPE_COLORS[config.baseType]}`}
                      >
                        {config.baseType}
                      </span>
                      <span className="text-xs text-on-surface-variant font-mono">{config.key}</span>
                      {config.isRequired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant">
                          {config.isRequired ? 'Required' : 'Optional'}
                        </span>
                        <RequiredToggle config={config} onToggle={handleToggleRequired} />
                      </div>
                      <button
                        onClick={() => handleDelete(config)}
                        disabled={deletingId === config.id}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingId === config.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {custom.length === 0 && !showForm && (
              <p className="text-sm text-on-surface-variant text-center py-4">
                No custom types yet. Click &quot;Add Custom Type&quot; to create one.
              </p>
            )}
          </div>
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
