'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAdminEmployeeReviews,
  AdminEmployeeReviewsResponse,
  AdminReviewEntry,
  AdminReviewAnswer,
} from '@/lib/reviews';

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

function ratingColor(rating: number) {
  if (rating >= 8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (rating >= 6) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (rating >= 4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

// ── Answer rendering ────────────────────────────────────────────────────────

function AnswerBlock({ answer }: { answer: AdminReviewAnswer }) {
  if (answer.questionType === 'RATING') {
    return answer.rating != null ? (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${ratingColor(answer.rating)}`}>
        {answer.rating}
      </span>
    ) : (
      <span className="text-sm text-on-surface-variant italic">No rating given</span>
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
      // Stored format: [{text, completed}] or [{id, label, completed}]
      tasks = raw.map((t: any) => ({
        text: t.text ?? t.label ?? '',
        completed: Boolean(t.completed),
      }));
    } catch {
      // Fallback: use predefined task labels from question metadata
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

// ── Review card (collapsible) ──────────────────────────────────────────────

function ReviewCard({ entry, peerIndex }: { entry: AdminReviewEntry; peerIndex: number }) {
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
              <p className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                {answer.questionText}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  answer.questionType === 'RATING' ? 'bg-primary/10 text-primary' :
                  answer.questionType === 'TEXT' ? 'bg-outline/20 text-on-surface-variant' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {answer.questionType === 'TASK_LIST' ? 'Tasks' : answer.questionType}
                </span>
              </p>
              <AnswerBlock answer={answer} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEmployeeReviews(cycleId, employeeId)
      .then(setData)
      .catch((err: any) => setError(err.message || 'Failed to load reviews'))
      .finally(() => setLoading(false));
  }, [cycleId, employeeId]);

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
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error || 'Data not found'}</p>
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
              <span className="bg-black/10 rounded-full px-1.5 py-px">{grouped[type].length}</span>
            </span>
          ))}
        </div>
      )}

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
                <ReviewCard key={entry.reviewId} entry={entry} peerIndex={peerIdx} />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
