'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import {
  ReviewTypeConfig,
  reviewTypeConfigsApi,
  CreateReviewTypeConfigDto,
  BaseReviewType,
} from '@/lib/review-type-configs';
import { useToast } from '@/components/ToastProvider';

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

export default function ReviewTypesPage() {
  const router = useRouter();
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

  const handleDelete = async (config: ReviewTypeConfig) => {
    if (!confirm(`Delete "${config.label}"? This will not affect existing cycles using this type.`)) {
      return;
    }
    setDeletingId(config.id);
    try {
      await reviewTypeConfigsApi.delete(config.id);
      setConfigs((prev) => prev.filter((c) => c.id !== config.id));
      toast.success(`"${config.label}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review type');
    } finally {
      setDeletingId(null);
    }
  };

  const builtIns = configs.filter((c) => c.isBuiltIn);
  const custom = configs.filter((c) => !c.isBuiltIn);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <BackButton href="/admin" label="← Back to Dashboard" />
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Review Types</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the reviewer roles available in your workflow steps. Built-in types cannot be
          removed. Custom types appear alongside built-ins when building cycle steps.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white shadow rounded-lg p-5 h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Built-in types */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Built-in Types</h2>
            <p className="text-sm text-gray-500 mb-4">
              These types are always available and cannot be deleted.
            </p>
            <div className="space-y-2">
              {builtIns.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{config.label}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BASE_TYPE_COLORS[config.baseType]}`}
                    >
                      {config.baseType}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Built-in</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom types */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Custom Types</h2>
                <p className="text-sm text-gray-500">
                  {custom.length === 0
                    ? 'No custom types yet. Add one below.'
                    : `${custom.length} custom type${custom.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
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

                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="e.g. Lead Review, Mentor Feedback, 360 Review"
                    maxLength={80}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Behavior <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formBaseType}
                    onChange={(e) => setFormBaseType(e.target.value as BaseReviewType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {(['SELF', 'MANAGER', 'PEER'] as BaseReviewType[]).map((bt) => (
                      <option key={bt} value={bt}>
                        {BASE_TYPE_LABELS[bt]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Determines how this review type behaves in the system (question set, assignment flow).
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
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
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Custom types list */}
            {custom.length > 0 && (
              <div className="space-y-2">
                {custom.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between py-2 px-3 border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">{config.label}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BASE_TYPE_COLORS[config.baseType]}`}
                      >
                        {config.baseType}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{config.key}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(config)}
                      disabled={deletingId === config.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deletingId === config.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {custom.length === 0 && !showForm && (
              <p className="text-sm text-gray-400 text-center py-4">
                No custom types yet. Click &quot;Add Custom Type&quot; to create one.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
