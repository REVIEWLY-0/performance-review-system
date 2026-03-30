'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAdminEmployeeReviews,
  setScoreOverride,
  deleteScoreOverride,
  AdminEmployeeReviewsResponse,
  AdminReviewEntry,
  AdminReviewAnswer,
} from '@/lib/reviews';
import { ratingScaleApi, RatingScale, DEFAULT_SCALE } from '@/lib/rating-scale';

interface PageProps {
  params: { id: string; employeeId: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function reviewTypeLabel(type: AdminReviewEntry['reviewType']) {
  switch (type) {
    case 'SELF':     return 'Self Review';
    case 'MANAGER':  return 'Manager Review';
    case 'DOWNWARD': return 'Downward Review';
    case 'PEER':     return 'Peer Review';
    default:         return type;
  }
}

function reviewTypeBadge(type: AdminReviewEntry['reviewType']) {
  switch (type) {
    case 'SELF':     return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'MANAGER':  return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'DOWNWARD': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'PEER':     return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    default:         return 'bg-surface-container text-on-surface';
  }
}

// ── Answer rendering ────────────────────────────────────────────────────────

function AnswerBlock({ answer, ratingScale }: { answer: AdminReviewAnswer; ratingScale: RatingScale }) {
  if (answer.questionType === 'RATING') {
    if (answer.rating == null) {
      return <span className="text-sm text-on-surface-variant italic">No rating given</span>;
    }
    const selectedLabel = ratingScale.labels[answer.rating - 1];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: ratingScale.maxRating }, (_, i) => i + 1).map((num) => (
            <div
              key={num}
              className={`min-w-[38px] px-2 py-2 border-2 rounded-lg text-center text-sm font-semibold transition-colors ${
                answer.rating === num
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-on-surface-variant opacity-30'
              }`}
            >
              {num}
            </div>
          ))}
        </div>
        {selectedLabel && (
          <p className="text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">{answer.rating} — {selectedLabel.title}</span>
            {selectedLabel.description && (
              <span className="ml-1">· {selectedLabel.description}</span>
            )}
          </p>
        )}
      </div>
    );
  }

  if (answer.questionType === 'TEXT') {
    return answer.textAnswer?.trim() ? (
      <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap bg-surface-container-low rounded-lg p-4 border border-outline-variant">
        {answer.textAnswer}
      </p>
    ) : (
      <span className="text-sm text-on-surface-variant italic">No response</span>
    );
  }

  if (answer.questionType === 'TASK_LIST') {
    let tasks: { text: string; completed: boolean }[] = [];
    try {
      const parsed = answer.textAnswer ? JSON.parse(answer.textAnswer) : null;
      const raw = parsed?.tasks ?? [];
      tasks = raw.map((t: any) => ({
        text: t.text ?? t.label ?? '',
        completed: Boolean(t.completed),
      }));
    } catch {
      tasks = (answer.tasks ?? []).map((t: any) => ({ text: t.label ?? '', completed: false }));
    }

    if (tasks.length === 0) {
      return <span className="text-sm text-on-surface-variant italic">No tasks recorded</span>;
    }

    const done = tasks.filter((t) => t.completed).length;
    return (
      <div>
        <p className="text-xs font-medium text-on-surface-variant mb-2">
          {done}/{tasks.length} completed
        </p>
        <ul className="space-y-2">
          {tasks.map((task, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                task.completed
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container'
              }`}>
                {task.completed ? '✓' : ''}
              </span>
              <span className={`text-sm ${task.completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                {task.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

// ── Question type pill ──────────────────────────────────────────────────────

function QuestionTypePill({ type }: { type: AdminReviewAnswer['questionType'] }) {
  const cls =
    type === 'RATING'
      ? 'bg-primary/10 text-primary'
      : type === 'TEXT'
      ? 'bg-surface-container-high text-on-surface-variant'
      : 'bg-surface-container-high text-on-surface-variant';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {type === 'TASK_LIST' ? 'Tasks' : type}
    </span>
  );
}

// ── Review card (collapsible) ──────────────────────────────────────────────

function ReviewCard({ entry, peerIndex, ratingScale }: { entry: AdminReviewEntry; peerIndex: number; ratingScale: RatingScale }) {
  const [open, setOpen] = useState(true);

  const reviewerLabel = entry.reviewer.isAnonymous
    ? `Peer Reviewer ${peerIndex + 1} (Anonymous)`
    : (entry.reviewer.name ?? 'Unknown');

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container-low transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${reviewTypeBadge(entry.reviewType)}`}>
            {reviewTypeLabel(entry.reviewType)}
          </span>
          <span className="text-sm font-medium text-on-surface truncate">{reviewerLabel}</span>
          <span className="shrink-0 text-xs text-on-surface-variant hidden sm:block">
            {new Date(entry.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <span className="ml-4 shrink-0 text-on-surface-variant text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-outline-variant">
          {entry.answers.length === 0 && (
            <div className="px-6 py-5 text-sm text-on-surface-variant italic">No answers recorded.</div>
          )}
          {entry.answers.map((answer) => (
            <div key={answer.questionId} className="px-6 py-5">
              <p className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2 flex-wrap">
                {answer.questionText}
                <QuestionTypePill type={answer.questionType} />
              </p>
              <AnswerBlock answer={answer} ratingScale={ratingScale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const TYPE_ORDER: AdminReviewEntry['reviewType'][] = ['SELF', 'DOWNWARD', 'MANAGER', 'PEER'];

export default function AdminEmployeeReviewsPage({ params }: PageProps) {
  const { id: cycleId, employeeId } = params;
  const [data, setData] = useState<AdminEmployeeReviewsResponse | null>(null);
  const [ratingScale, setRatingScale] = useState<RatingScale>(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual score override state
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  useEffect(() => {
    Promise.all([
      getAdminEmployeeReviews(cycleId, employeeId),
      ratingScaleApi.get(),
    ])
      .then(([d, scale]) => {
        setData(d);
        setRatingScale(scale);
        if (d.scoreOverride) {
          setOverrideScore(String(d.scoreOverride.score));
          setOverrideNote(d.scoreOverride.note ?? '');
        }
      })
      .catch((err: any) => setError(err.message || 'Failed to load reviews'))
      .finally(() => setLoading(false));
  }, [cycleId, employeeId]);

  const handleSaveOverride = async () => {
    const score = parseFloat(overrideScore);
    if (isNaN(score) || score < 0 || score > 10) {
      setOverrideMsg('Score must be between 0 and 10');
      return;
    }
    try {
      setOverrideSaving(true);
      setOverrideMsg('');
      const res = await setScoreOverride(cycleId, employeeId, score, overrideNote || undefined);
      setOverrideMsg(res.message);
      setData((d) => d ? { ...d, scoreOverride: { score, note: overrideNote || null, createdAt: new Date().toISOString() } } : d);
    } catch (err: any) {
      setOverrideMsg(err.message || 'Failed to save override');
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleRemoveOverride = async () => {
    try {
      setOverrideSaving(true);
      setOverrideMsg('');
      await deleteScoreOverride(cycleId, employeeId);
      setOverrideScore('');
      setOverrideNote('');
      setOverrideMsg('Override removed — calculated score will be used');
      setData((d) => d ? { ...d, scoreOverride: null } : d);
    } catch (err: any) {
      setOverrideMsg(err.message || 'Failed to remove override');
    } finally {
      setOverrideSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-surface-container-high rounded w-64" />
        <div className="h-7 bg-surface-container-high rounded w-80" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-surface-container-high rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Link href={`/admin/cycles/${cycleId}/scores`} className="text-sm text-primary hover:underline mb-4 inline-block">
          ← Back to Scores
        </Link>
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error || 'Data not found'}</p>
        </div>
      </div>
    );
  }

  // Group by type
  const grouped = data.reviews.reduce<Record<string, AdminReviewEntry[]>>((acc, r) => {
    (acc[r.reviewType] ??= []).push(r);
    return acc;
  }, {});

  // Track per-type peer index for anonymisation labels
  const peerCounters: Record<string, number> = {};

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/admin/cycles/${cycleId}/scores`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors"
      >
        ← Back to Scores
      </Link>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-on-surface-variant flex-wrap">
        <Link href="/admin/reports" className="hover:text-primary transition-colors">Reports</Link>
        <span>/</span>
        <Link href={`/admin/cycles/${cycleId}/scores`} className="hover:text-primary transition-colors">
          {data.cycle.name}
        </Link>
        <span>/</span>
        <span className="text-on-surface font-medium">{data.employee.name}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-on-surface">{data.employee.name}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          {data.employee.email}
          {data.employee.department ? ` · ${data.employee.department}` : ''}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Cycle: <span className="font-medium text-on-surface">{data.cycle.name}</span>
          {' · '}
          {data.reviews.length} submitted {data.reviews.length === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      {/* Type summary chips */}
      {data.reviews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TYPE_ORDER.filter((t) => grouped[t]?.length).map((type) => (
            <span key={type} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${reviewTypeBadge(type)}`}>
              {reviewTypeLabel(type)}
              <span className="bg-black/10 dark:bg-white/10 rounded-full px-1.5 py-px">{grouped[type].length}</span>
            </span>
          ))}
        </div>
      )}

      {/* Manual Score Override */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6">
        <h2 className="text-base font-bold text-on-surface mb-1">Manual Score Override</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          After reading text answers, you can assign a manual overall score (0–10) that overrides the calculated score.
          {data.scoreOverride && (
            <span className="ml-1 font-medium text-primary">
              Current override: {data.scoreOverride.score.toFixed(2)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Score (0–10)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              placeholder="e.g. 7.5"
              className="w-28 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Note (optional)</label>
            <input
              type="text"
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Reason for manual override..."
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSaveOverride}
            disabled={overrideSaving || !overrideScore}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {overrideSaving ? 'Saving...' : 'Save Override'}
          </button>
          {data.scoreOverride && (
            <button
              onClick={handleRemoveOverride}
              disabled={overrideSaving}
              className="px-4 py-2 rounded-lg border border-outline-variant text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
            >
              Remove Override
            </button>
          )}
        </div>
        {overrideMsg && (
          <p className={`mt-3 text-sm ${
            overrideMsg.includes('Failed') || overrideMsg.includes('must be')
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'
          }`}>
            {overrideMsg}
          </p>
        )}
      </div>

      {/* No reviews yet */}
      {data.reviews.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-12 text-center">
          <p className="text-sm font-medium text-on-surface">No submitted reviews yet</p>
          <p className="mt-1 text-sm text-on-surface-variant">Reviews will appear here once submitted.</p>
        </div>
      )}

      {/* Grouped sections */}
      {TYPE_ORDER.filter((t) => grouped[t]?.length).map((type) => (
        <section key={type}>
          <h2 className="text-base font-bold text-on-surface mb-3">
            {reviewTypeLabel(type)}
            <span className="ml-2 text-sm font-normal text-on-surface-variant">({grouped[type].length})</span>
          </h2>
          <div className="space-y-4">
            {grouped[type].map((entry) => {
              const peerIdx = peerCounters[type] ?? 0;
              if (entry.reviewer.isAnonymous) peerCounters[type] = peerIdx + 1;
              return (
                <ReviewCard key={entry.reviewId} entry={entry} peerIndex={peerIdx} ratingScale={ratingScale} />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
