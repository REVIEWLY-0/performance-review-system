'use client'

import { useRouter } from 'next/navigation'

export default function ReportsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-display">Reports</h1>
        <p className="text-on-surface-variant font-medium">Analytics and performance reports for your organisation.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-16 flex flex-col items-center justify-center text-center shadow-sm">
        <div className="w-16 h-16 mb-6 bg-surface-container rounded-full flex items-center justify-center">
          <svg className="h-8 w-8 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold font-display text-on-surface mb-2">Reports — Coming Soon</h2>
        <p className="text-on-surface-variant text-sm max-w-sm">
          Detailed performance analytics, score breakdowns, and cycle summaries will be available here.
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-8 px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold text-sm hover:bg-primary-dim transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
