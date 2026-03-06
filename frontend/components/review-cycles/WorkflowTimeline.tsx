'use client';

import { ReviewConfig, getReviewTypeColor } from '@/lib/review-cycles';

interface WorkflowTimelineProps {
  cycleStart: string;
  cycleEnd: string;
  steps: ReviewConfig[];
}

export default function WorkflowTimeline({
  cycleStart,
  cycleEnd,
  steps,
}: WorkflowTimelineProps) {
  if (!cycleStart || !cycleEnd || steps.length === 0) {
    return null;
  }

  const start = new Date(cycleStart).getTime();
  const end = new Date(cycleEnd).getTime();
  const totalDuration = end - start;

  const getStepPosition = (step: ReviewConfig) => {
    const stepStart = new Date(step.startDate).getTime();
    const stepEnd = new Date(step.endDate).getTime();

    const left = ((stepStart - start) / totalDuration) * 100;
    const width = ((stepEnd - stepStart) / totalDuration) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0, width)}%` };
  };

  const colorMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-500',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Timeline Preview
      </h2>

      {/* Timeline Container */}
      <div className="relative pt-8 pb-4">
        {/* Cycle Duration Background Bar */}
        <div className="relative h-2 bg-gray-200 rounded-full mb-12">
          {/* Start Date Label */}
          <div className="absolute left-0 -top-6 text-xs text-gray-500">
            {formatDate(cycleStart)}
          </div>
          {/* End Date Label */}
          <div className="absolute right-0 -top-6 text-xs text-gray-500 text-right">
            {formatDate(cycleEnd)}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const position = getStepPosition(step);
            const color = getReviewTypeColor(step.reviewType);
            const colorClass =
              colorMap[color as keyof typeof colorMap] || colorMap.gray;

            return (
              <div key={index} className="relative h-14">
                <div
                  className={`absolute h-14 ${colorClass} rounded-lg flex items-center justify-center text-white text-sm font-medium shadow-md transition-all hover:shadow-lg`}
                  style={position}
                >
                  <span className="px-2 text-center leading-tight">
                    {step.name || `Step ${step.stepNumber}: ${step.reviewType}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Self Review</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600">Manager Review</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span className="text-sm text-gray-600">Peer Review</span>
        </div>
      </div>

      {/* Note about overlapping */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          💡 <strong>Tip:</strong> Steps can overlap to allow parallel reviews
          (e.g., Self and Manager reviews happening simultaneously).
        </p>
      </div>
    </div>
  );
}
