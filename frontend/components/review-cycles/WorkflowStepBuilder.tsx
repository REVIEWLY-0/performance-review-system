'use client';

import { useState, useEffect } from 'react';
import { ReviewConfig, ReviewType } from '@/lib/review-cycles';
import { ReviewTypeConfig, reviewTypeConfigsApi } from '@/lib/review-type-configs';

interface WorkflowStepBuilderProps {
  cycleStart: string;
  cycleEnd: string;
  steps: ReviewConfig[];
  onChange: (steps: ReviewConfig[]) => void;
}

export default function WorkflowStepBuilder({
  cycleStart,
  cycleEnd,
  steps,
  onChange,
}: WorkflowStepBuilderProps) {
  const [reviewTypeConfigs, setReviewTypeConfigs] = useState<ReviewTypeConfig[]>([]);

  useEffect(() => {
    reviewTypeConfigsApi
      .getAll()
      .then(setReviewTypeConfigs)
      .catch(() => {
        // Fallback to built-ins if API fails
        setReviewTypeConfigs([
          { id: 'self', companyId: '', key: 'SELF', label: 'Self Review', baseType: 'SELF', isBuiltIn: true, isRequired: false, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' },
          { id: 'manager', companyId: '', key: 'MANAGER', label: 'Manager Review', baseType: 'MANAGER', isBuiltIn: true, isRequired: true, isActive: true, sortOrder: 1, createdAt: '', updatedAt: '' },
          { id: 'peer', companyId: '', key: 'PEER', label: 'Peer Review', baseType: 'PEER', isBuiltIn: true, isRequired: false, isActive: true, sortOrder: 2, createdAt: '', updatedAt: '' },
        ]);
      });
  }, []);

  const labelForStep = (step: ReviewConfig): string => {
    if (step.customTypeKey) {
      const config = reviewTypeConfigs.find((c) => c.key === step.customTypeKey);
      return config?.label ?? step.customTypeKey;
    }
    return reviewTypeConfigs.find((c) => c.key === step.reviewType)?.label ?? step.reviewType;
  };

  const addStep = () => {
    const defaultConfig = reviewTypeConfigs[0];
    const newStep: ReviewConfig = {
      stepNumber: steps.length + 1,
      reviewType: (defaultConfig?.baseType ?? 'SELF') as ReviewType,
      customTypeKey: defaultConfig && !defaultConfig.isBuiltIn ? defaultConfig.key : undefined,
      name: defaultConfig?.label ?? 'Self Review',
      startDate: cycleStart || new Date().toISOString().split('T')[0],
      endDate: cycleEnd || new Date().toISOString().split('T')[0],
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((step, i) => (step.stepNumber = i + 1));
    onChange(newSteps);
  };

  const updateStep = (index: number, field: keyof ReviewConfig, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    onChange(newSteps);
  };

  // Get the current select value for a step: customTypeKey if set, else reviewType
  const selectValueForStep = (step: ReviewConfig): string =>
    step.customTypeKey ?? step.reviewType;

  const hasSelfReview = steps.some(
    (step) => step.reviewType === 'SELF' && !step.customTypeKey,
  );

  const handleTypeChange = (index: number, selectedKey: string) => {
    const config = reviewTypeConfigs.find((c) => c.key === selectedKey);
    if (!config) return;

    const newSteps = [...steps];
    const isBuiltIn = config.isBuiltIn;
    newSteps[index] = {
      ...newSteps[index],
      reviewType: config.baseType as ReviewType,
      customTypeKey: isBuiltIn ? undefined : config.key,
    };

    // Auto-update name if it still matches a default
    const currentName = newSteps[index].name ?? '';
    const oldLabel = labelForStep(steps[index]);
    if (!currentName || currentName === oldLabel) {
      newSteps[index].name = config.label;
    }

    onChange(newSteps);
  };

  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Workflow Steps</h2>
          <p className="text-sm text-on-surface-variant">Define the review process and timeline</p>
        </div>
        <button
          type="button"
          onClick={addStep}
          disabled={!cycleStart || !cycleEnd}
          className="px-3 py-2 border border-outline rounded-md text-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low disabled:opacity-50"
          title={!cycleStart || !cycleEnd ? 'Set cycle dates first' : 'Add a new workflow step'}
        >
          + Add Step
        </button>
      </div>

      {!cycleStart || !cycleEnd ? (
        <div className="text-center py-8 text-on-surface-variant bg-surface-container-low rounded-lg">
          <p>Please set cycle start and end dates first</p>
        </div>
      ) : steps.length === 0 ? (
        <div className="text-center py-8 text-on-surface-variant bg-surface-container-low rounded-lg">
          <p>No workflow steps yet. Click &quot;Add Step&quot; to begin.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {steps.map((step, index) => (
            <div key={index} className="border border-outline-variant rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Step Number */}
                <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-semibold text-indigo-600">
                    {step.stepNumber}
                  </span>
                </div>

                {/* Step Details */}
                <div className="flex-1 space-y-3">
                  {/* Name field */}
                  <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">
                      Step Label
                    </label>
                    <input
                      type="text"
                      value={step.name ?? ''}
                      onChange={(e) => updateStep(index, 'name', e.target.value)}
                      placeholder="e.g. Self Review, Manager Feedback Round 1…"
                      maxLength={100}
                      className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Type + dates row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">
                        Review Type
                      </label>
                      <select
                        value={selectValueForStep(step)}
                        onChange={(e) => handleTypeChange(index, e.target.value)}
                        className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                      >
                        {reviewTypeConfigs.map((config) => (
                          <option
                            key={config.key}
                            value={config.key}
                            disabled={
                              config.key === 'SELF' &&
                              hasSelfReview &&
                              selectValueForStep(step) !== 'SELF'
                            }
                          >
                            {config.label}
                            {!config.isBuiltIn && ' ✦'}
                            {config.key === 'SELF' &&
                              hasSelfReview &&
                              selectValueForStep(step) !== 'SELF' &&
                              ' (already added)'}
                          </option>
                        ))}
                      </select>
                      {step.customTypeKey && (
                        <p className="mt-1 text-xs text-indigo-600">
                          Custom type · behaves as {step.reviewType.toLowerCase()} review
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={step.startDate}
                        onChange={(e) => updateStep(index, 'startDate', e.target.value)}
                        min={cycleStart}
                        max={cycleEnd}
                        className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={step.endDate}
                        onChange={(e) => updateStep(index, 'endDate', e.target.value)}
                        min={cycleStart}
                        max={cycleEnd}
                        className="w-full px-3 py-2 border border-outline rounded-md text-sm focus:outline-none focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="flex-shrink-0 text-red-600 hover:text-red-800 mt-6"
                  title="Remove step"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
