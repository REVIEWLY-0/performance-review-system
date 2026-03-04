'use client';

import { ReviewConfig, ReviewType } from '@/lib/review-cycles';

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
  const addStep = () => {
    const newStep: ReviewConfig = {
      stepNumber: steps.length + 1,
      reviewType: 'SELF',
      startDate: cycleStart || new Date().toISOString().split('T')[0],
      endDate: cycleEnd || new Date().toISOString().split('T')[0],
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Renumber steps
    newSteps.forEach((step, i) => (step.stepNumber = i + 1));
    onChange(newSteps);
  };

  const updateStep = (
    index: number,
    field: keyof ReviewConfig,
    value: any,
  ) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    onChange(newSteps);
  };

  const reviewTypes: { value: ReviewType; label: string; color: string }[] = [
    { value: 'SELF', label: 'Self Review', color: 'blue' },
    { value: 'MANAGER', label: 'Manager Review', color: 'green' },
    { value: 'PEER', label: 'Peer Review', color: 'purple' },
  ];

  const hasSelfReview = steps.some((step) => step.reviewType === 'SELF');

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Workflow Steps
          </h2>
          <p className="text-sm text-gray-600">
            Define the review process and timeline
          </p>
        </div>
        <button
          type="button"
          onClick={addStep}
          disabled={!cycleStart || !cycleEnd}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          title={
            !cycleStart || !cycleEnd
              ? 'Set cycle dates first'
              : 'Add a new workflow step'
          }
        >
          + Add Step
        </button>
      </div>

      {!cycleStart || !cycleEnd ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>Please set cycle start and end dates first</p>
        </div>
      ) : steps.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>No workflow steps yet. Click "Add Step" to begin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Step Number */}
                <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-semibold text-indigo-600">
                    {step.stepNumber}
                  </span>
                </div>

                {/* Step Details */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Type
                    </label>
                    <select
                      value={step.reviewType}
                      onChange={(e) =>
                        updateStep(
                          index,
                          'reviewType',
                          e.target.value as ReviewType,
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {reviewTypes.map((type) => (
                        <option
                          key={type.value}
                          value={type.value}
                          disabled={
                            type.value === 'SELF' &&
                            hasSelfReview &&
                            step.reviewType !== 'SELF'
                          }
                        >
                          {type.label}
                          {type.value === 'SELF' &&
                            hasSelfReview &&
                            step.reviewType !== 'SELF' &&
                            ' (already added)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={step.startDate}
                      onChange={(e) =>
                        updateStep(index, 'startDate', e.target.value)
                      }
                      min={cycleStart}
                      max={cycleEnd}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={step.endDate}
                      onChange={(e) =>
                        updateStep(index, 'endDate', e.target.value)
                      }
                      min={cycleStart}
                      max={cycleEnd}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="flex-shrink-0 text-red-600 hover:text-red-800 mt-6"
                  title="Remove step"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
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
