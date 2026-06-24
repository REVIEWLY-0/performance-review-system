'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles'
import { listGoals, createGoal, updateGoal, deleteGoal, upsertQuantScore, getQuantScore, EmployeeGoal } from '@/lib/goals'

interface Employee {
  id: string
  name: string
  email: string
  department?: string | null
}

const RATINGS = [1, 2, 3, 4, 5]

function GoalRow({
  goal,
  onRatingChange,
  onDelete,
}: {
  goal: EmployeeGoal
  onRatingChange: (id: string, rating: number | null) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-on-surface text-sm truncate">{goal.title}</div>
        {goal.description && (
          <div className="text-xs text-on-surface-variant truncate">{goal.description}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {RATINGS.map((r) => (
          <button
            key={r}
            onClick={() => onRatingChange(goal.id, goal.rating === r ? null : r)}
            className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
              goal.rating === r
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <button
        onClick={() => onDelete(goal.id)}
        className="text-on-surface-variant hover:text-error transition-colors ml-2"
        aria-label="Delete goal"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function GoalsPage() {
  const { id: cycleId } = useParams<{ id: string }>()

  const [cycle, setCycle] = useState<ReviewCycle | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [goals, setGoals] = useState<EmployeeGoal[]>([])
  const [quantScore, setQuantScore] = useState<number | null>(null)
  const [quantNote, setQuantNote] = useState('')
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    Promise.all([
      reviewCyclesApi.getOne(cycleId),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      }).then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([cycleData, usersResp]) => {
        setCycle(cycleData)
        const users = Array.isArray(usersResp) ? usersResp : (usersResp.data ?? [])
        setEmployees(users)
        if (users.length > 0) setSelectedEmpId(users[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId])

  useEffect(() => {
    if (!selectedEmpId || !cycleId) return
    setGoalsLoading(true)
    Promise.all([
      listGoals(cycleId, selectedEmpId),
      getQuantScore(cycleId, selectedEmpId),
    ])
      .then(([g, qs]) => {
        setGoals(g)
        setQuantScore(qs?.score ?? null)
        setQuantNote(qs?.note ?? '')
      })
      .catch(() => setGoals([]))
      .finally(() => setGoalsLoading(false))
  }, [selectedEmpId, cycleId])

  function getToken() {
    try {
      const raw = localStorage.getItem('sb-auth-token') || ''
      const parsed = JSON.parse(raw)
      return parsed?.access_token || ''
    } catch { return '' }
  }

  const addGoal = async () => {
    if (!newGoalTitle.trim() || !selectedEmpId) return
    try {
      const goal = await createGoal({ cycleId, employeeId: selectedEmpId, title: newGoalTitle.trim() })
      setGoals((prev) => [...prev, goal])
      setNewGoalTitle('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleRating = async (goalId: string, rating: number | null) => {
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, rating } : g))
    try {
      await updateGoal(goalId, { rating: rating ?? undefined })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDelete = async (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
    try {
      await deleteGoal(goalId)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const saveQuantScore = async () => {
    if (quantScore == null || !selectedEmpId) return
    setSaving(true)
    try {
      await upsertQuantScore({ cycleId, employeeId: selectedEmpId, score: quantScore, note: quantNote || undefined })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ratedGoals = goals.filter((g) => g.rating != null)
  const goalsAvg = ratedGoals.length > 0
    ? (ratedGoals.reduce((s, g) => s + (g.rating ?? 0), 0) / ratedGoals.length).toFixed(2)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Goals & Quant Scores</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          {cycle?.name} — set employee goals and rate them, or enter a direct quantitative score.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Employee selector */}
      <div className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-3">
        <h2 className="font-semibold text-on-surface">Select Employee</h2>
        <select
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(e.target.value)}
          className="w-full rounded-xl border border-outline bg-surface-container px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} {emp.department ? `(${emp.department})` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedEmpId && (
        <>
          {/* Goals section */}
          <div className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-on-surface">Goals</h2>
              {goalsAvg && (
                <span className="text-sm font-bold text-primary">
                  Avg rating: {goalsAvg}
                </span>
              )}
            </div>

            {goalsLoading ? (
              <div className="py-6 flex justify-center">
                <div className="animate-spin h-6 w-6 rounded-full border-b-2 border-primary" />
              </div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-4 text-center">No goals set yet</p>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => (
                  <GoalRow key={g.id} goal={g} onRatingChange={handleRating} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {/* Add goal */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                placeholder="Add a goal…"
                className="flex-1 rounded-xl border border-outline bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={addGoal}
                disabled={!newGoalTitle.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </div>
          </div>

          {/* Quant score fallback */}
          <div className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-4">
            <h2 className="font-semibold text-on-surface">Overall Quant Score (fallback)</h2>
            <p className="text-sm text-on-surface-variant">
              Used only if no rated goals exist. Enter a score 1–5.
            </p>
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant font-medium">Score (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={quantScore ?? ''}
                  onChange={(e) => setQuantScore(e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g. 3.5"
                  className="w-28 rounded-xl border border-outline bg-surface-container px-3 py-2 text-sm text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-on-surface-variant font-medium">Note (optional)</label>
                <input
                  type="text"
                  value={quantNote}
                  onChange={(e) => setQuantNote(e.target.value)}
                  placeholder="Optional note"
                  className="w-full rounded-xl border border-outline bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={saveQuantScore}
                disabled={quantScore == null || saving}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
