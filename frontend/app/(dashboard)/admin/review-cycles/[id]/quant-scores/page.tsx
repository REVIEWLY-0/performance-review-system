'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles';
import {
  departmentQuantScoresApi,
  DepartmentQuantScoreEntry,
} from '@/lib/department-quant-scores';
import BackButton from '@/components/BackButton';
import { useToast } from '@/components/ToastProvider';

// Per-row state: draft score + note + saving flag
interface RowDraft {
  score: string;
  note: string;
  saving: boolean;
}

function ScoreRow({
  entry,
  cycleId,
  onSaved,
}: {
  entry: DepartmentQuantScoreEntry;
  cycleId: string;
  onSaved: (departmentId: string, score: number, note: string) => void;
}) {
  const [draft, setDraft] = useState<RowDraft>({
    score: entry.score != null ? String(entry.score) : '',
    note: entry.note ?? '',
    saving: false,
  });
  const toast = useToast();

  const scoreNum = parseFloat(draft.score);
  const isValid = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 5;
  const isDirty =
    draft.score !== (entry.score != null ? String(entry.score) : '') ||
    draft.note !== (entry.note ?? '');

  const handleSave = async () => {
    if (!isValid) return;
    setDraft((d) => ({ ...d, saving: true }));
    try {
      await departmentQuantScoresApi.upsert({
        cycleId,
        departmentId: entry.department.id,
        score: scoreNum,
        note: draft.note || undefined,
      });
      onSaved(entry.department.id, scoreNum, draft.note);
      toast.success(`Saved score for ${entry.department.name}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setDraft((d) => ({ ...d, saving: false }));
    }
  };

  return (
    <tr className="border-b border-outline-variant/40 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-on-surface">
        {entry.department.name}
      </td>
      <td className="py-3 pr-4">
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={draft.score}
          onChange={(e) => setDraft((d) => ({ ...d, score: e.target.value }))}
          placeholder="0–5"
          className={[
            'w-24 rounded-xl border px-3 py-1.5 text-sm font-mono text-on-surface bg-surface-container',
            'focus:outline-none focus:ring-2 focus:ring-primary',
            !isValid && draft.score !== '' ? 'border-error' : 'border-outline',
          ].join(' ')}
        />
      </td>
      <td className="py-3 pr-4">
        <input
          type="text"
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          placeholder="Optional note"
          className="w-full max-w-xs rounded-xl border border-outline bg-surface-container px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </td>
      <td className="py-3 pr-4 text-xs text-on-surface-variant whitespace-nowrap">
        {entry.setBy ? entry.setBy.name : '—'}
      </td>
      <td className="py-3">
        <button
          onClick={handleSave}
          disabled={!isValid || !isDirty || draft.saving}
          className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {draft.saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

export default function QuantScoresPage() {
  const { id: cycleId } = useParams<{ id: string }>();
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [entries, setEntries] = useState<DepartmentQuantScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    Promise.all([
      reviewCyclesApi.getOne(cycleId),
      departmentQuantScoresApi.getByCycle(cycleId),
    ])
      .then(([cycleData, scoreData]) => {
        setCycle(cycleData);
        setEntries(scoreData);
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const handleSaved = (departmentId: string, score: number, note: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.department.id === departmentId ? { ...e, score, note } : e,
      ),
    );
  };

  const scored = entries.filter((e) => e.score != null).length;
  const total = entries.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <BackButton
        href={`/admin/review-cycles/${cycleId}`}
        label="← Back to Cycle"
      />

      <div>
        <h1 className="text-2xl font-bold text-on-surface">Department Quant Scores</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          {cycle?.name} — Enter a score (0–5) per department. Each employee's quant
          score is the mean of their departments' scores.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-surface border border-outline-variant p-1.5">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-on-surface">
            {scored} of {total} departments scored
          </span>
          {total > 0 && (
            <div className="w-32 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${total > 0 ? (scored / total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            No active departments found. Create departments first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/40">
                  <th className="pb-2 pr-4 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    Department
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    Score (0–5)
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    Note
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                    Set by
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <ScoreRow
                    key={entry.department.id}
                    entry={entry}
                    cycleId={cycleId}
                    onSaved={handleSaved}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
