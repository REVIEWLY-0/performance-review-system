'use client';

import { ReviewConfig } from '@/lib/review-cycles';

interface WorkflowTimelineProps {
  cycleStart: string;
  cycleEnd: string;
  steps: ReviewConfig[];
}

// Standard Tailwind color classes that exist in the default palette (not CSS-var-based)
// barBg is applied to a nested opacity div so the text stays fully opaque
const STEP_STYLES: Record<string, { barBg: string; border: string; text: string }> = {
  SELF:     { barBg: 'bg-blue-500',   border: 'border-blue-500',   text: 'text-blue-700 dark:text-blue-400'   },
  DOWNWARD: { barBg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-400' },
  MANAGER:  { barBg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-700 dark:text-violet-400' },
  PEER:     { barBg: 'bg-teal-500',   border: 'border-teal-500',   text: 'text-teal-700 dark:text-teal-400'   },
};
const DEFAULT_STYLE = { barBg: 'bg-slate-400', border: 'border-slate-400', text: 'text-slate-600' };

const BAR_H   = 28; // px height of each bar row
const BAR_GAP = 12; // px gap between rows
const LABELS  = 4;  // number of date markers

export default function WorkflowTimeline({ cycleStart, cycleEnd, steps }: WorkflowTimelineProps) {
  if (!cycleStart || !cycleEnd || steps.length === 0) return null;

  const startMs   = new Date(cycleStart).getTime();
  const endMs     = new Date(cycleEnd).getTime();
  const totalMs   = Math.max(endMs - startMs, 1);

  // Evenly-spaced date labels
  const labels = Array.from({ length: LABELS }, (_, i) => ({
    date: new Date(startMs + (totalMs / (LABELS - 1)) * i),
    pct:  (i / (LABELS - 1)) * 100,
  }));

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getBar = (step: ReviewConfig) => {
    const s = new Date(step.startDate).getTime();
    const e = new Date(step.endDate).getTime();
    if (isNaN(s) || isNaN(e)) return { left: '0%', width: '100%' };
    const left  = Math.max(0, Math.min(99, ((s - startMs) / totalMs) * 100));
    const width = Math.max(1, Math.min(100 - left, ((e - s) / totalMs) * 100));
    return { left: `${left}%`, width: `${width}%` };
  };

  const trackH = steps.length * BAR_H + Math.max(0, steps.length - 1) * BAR_GAP;

  return (
    <div className="bg-surface-container-lowest shadow rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
          <span
            className="material-symbols-outlined select-none leading-none text-[20px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            timeline
          </span>
        </div>
        <h2 className="text-lg font-bold text-on-surface">Timeline Preview</h2>
      </div>

      <div className="pb-2">
        {/* Date labels */}
        <div className="relative h-5 mb-3">
          {labels.map(({ date, pct }, i) => (
            <span
              key={i}
              className="absolute text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap"
              style={{
                left: `${pct}%`,
                transform:
                  i === 0              ? 'none'
                  : i === LABELS - 1   ? 'translateX(-100%)'
                  :                      'translateX(-50%)',
              }}
            >
              {fmt(date)}
            </span>
          ))}
        </div>

        {/* Track — grid lines + bars */}
        <div className="relative w-full" style={{ height: trackH }}>
          {/* Vertical grid lines */}
          {labels.map(({ pct }, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-outline-variant/30"
              style={{ left: `${pct}%` }}
            />
          ))}

          {/* Step bars */}
          {steps.map((step, i) => {
            const bar   = getBar(step);
            const style = STEP_STYLES[step.reviewType] ?? DEFAULT_STYLE;
            const label = step.name
              ? `${step.name} Phase`
              : `${step.reviewType.charAt(0) + step.reviewType.slice(1).toLowerCase().replace('_', ' ')} Phase`;
            const top = i * (BAR_H + BAR_GAP);

            return (
              <div
                key={i}
                className="absolute w-full"
                style={{ top, height: BAR_H }}
              >
                {/* Positioned bar */}
                <div
                  className={`absolute h-full rounded-lg overflow-hidden border-l-4 ${style.border}`}
                  style={{ left: bar.left, width: bar.width }}
                >
                  {/* Semi-transparent fill — opacity on this div only, not the text */}
                  <div className={`absolute inset-0 ${style.barBg}`} style={{ opacity: 0.15 }} />
                  {/* Label */}
                  <div className="relative z-10 h-full flex items-center px-3">
                    <span className={`text-[10px] font-bold truncate ${style.text}`}>
                      {label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
