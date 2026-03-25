'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreateReviewCycleDto,
  UpdateReviewCycleDto,
  ReviewConfig,
  ReviewCycle,
} from '@/lib/review-cycles';
import WorkflowStepBuilder from './WorkflowStepBuilder';
import WorkflowTimeline from './WorkflowTimeline';

interface ReviewCycleFormProps {
  initialData?: ReviewCycle;
  onSubmit: (
    data: CreateReviewCycleDto | UpdateReviewCycleDto,
    configs?: ReviewConfig[],
  ) => Promise<void>;
  mode: 'create' | 'edit';
}

export default function ReviewCycleForm({
  initialData,
  onSubmit,
  mode,
}: ReviewCycleFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    startDate: initialData?.startDate.split('T')[0] || '',
    endDate: initialData?.endDate.split('T')[0] || '',
    reviewConfigs: initialData?.reviewConfigs || ([] as ReviewConfig[]),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Cycle name is required');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Start and end dates are required');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setError('Start date must be before end date');
      return;
    }

    if (formData.reviewConfigs.length === 0) {
      setError('At least one workflow step is required');
      return;
    }

    // Validate step dates
    const cycleStart = new Date(formData.startDate);
    const cycleEnd = new Date(formData.endDate);
    for (const config of formData.reviewConfigs) {
      const stepStart = new Date(config.startDate);
      const stepEnd = new Date(config.endDate);

      if (stepStart >= stepEnd) {
        setError(
          `Step ${config.stepNumber}: start date must be before end date`,
        );
        return;
      }

      if (stepStart < cycleStart || stepEnd > cycleEnd) {
        setError(
          `Step ${config.stepNumber}: dates must fall within cycle dates`,
        );
        return;
      }
    }

    // Validate no duplicate Self Review steps
    const selfReviewSteps = formData.reviewConfigs.filter(
      (config) => config.reviewType === 'SELF',
    );
    if (selfReviewSteps.length > 1) {
      setError('Only one Self Review step is allowed');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'create') {
        await onSubmit({
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reviewConfigs: formData.reviewConfigs,
        } as CreateReviewCycleDto);
      } else {
        await onSubmit(
          {
            name: formData.name,
            startDate: formData.startDate,
            endDate: formData.endDate,
          } as UpdateReviewCycleDto,
          formData.reviewConfigs,
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save review cycle');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/review-cycles');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-surface-container-lowest shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4">
          Basic Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Cycle Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Q1 2024 Performance Review"
              className="w-full px-3 py-2 border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              required
            />
            <p className="mt-1 text-sm text-on-surface-variant">
              Give this review cycle a descriptive name
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                min={formData.startDate}
                className="w-full px-3 py-2 border border-outline rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Builder */}
      <WorkflowStepBuilder
        cycleStart={formData.startDate}
        cycleEnd={formData.endDate}
        steps={formData.reviewConfigs}
        onChange={(steps) =>
          setFormData({ ...formData, reviewConfigs: steps })
        }
      />

      {/* Timeline Preview */}
      {formData.reviewConfigs.length > 0 && (
        <WorkflowTimeline
          cycleStart={formData.startDate}
          cycleEnd={formData.endDate}
          steps={formData.reviewConfigs}
        />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
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
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 border border-outline rounded-md shadow-sm text-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dim disabled:opacity-50"
        >
          {loading
            ? mode === 'create'
              ? 'Creating...'
              : 'Updating...'
            : mode === 'create'
              ? 'Create Review Cycle'
              : 'Update Review Cycle'}
        </button>
      </div>
    </form>
  );
}
