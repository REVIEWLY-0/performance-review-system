'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewCyclesApi, ReviewCycle, getStatusColor } from '@/lib/review-cycles'

export default function ReportsPage() {
  const router = useRouter()
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reviewCyclesApi.getAll()
      .then((res) => setCycles(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-display">Reports</h1>
        <p className="text-on-surface-variant font-medium">Select a review cycle to view its scores and performance data.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-container-high animate-pulse" />
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-14 h-14 mb-4 bg-surface-container rounded-full flex items-center justify-center">
            <svg className="h-7 w-7 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="font-bold text-on-surface">No review cycles yet</p>
          <p className="text-sm text-on-surface-variant mt-1">Create a review cycle to start generating reports.</p>
          <button
            onClick={() => router.push('/admin/review-cycles/new')}
            className="mt-6 px-5 py-2.5 bg-primary text-on-primary rounded-lg font-bold text-sm hover:bg-primary-dim transition-colors"
          >
            New Review Cycle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cycles.map((cycle) => (
            <button
              key={cycle.id}
              onClick={() => router.push(`/admin/cycles/${cycle.id}/scores`)}
              className="group bg-surface-container-lowest rounded-xl border border-outline-variant p-6 text-left shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-surface-container rounded-lg">
                  <svg className="h-5 w-5 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(cycle.status)}`}>
                  {cycle.status}
                </span>
              </div>
              <p className="font-display font-bold text-on-surface text-base leading-snug">{cycle.name}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {new Date(cycle.startDate).toLocaleDateString()} — {new Date(cycle.endDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-primary font-bold mt-4 group-hover:underline">View Scores →</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
