'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getCurrentUser, User } from '@/lib/auth'
import { reviewCyclesApi, ReviewCycle } from '@/lib/review-cycles'
import {
  getMyReceivedReviews,
  ReceivedReviewsResponse,
  AttributedReview,
  AnonymousSection,
  WithheldSection,
  ReceivedAnswer,
} from '@/lib/received-reviews'

function AnswerList({ answers }: { answers: ReceivedAnswer[] }) {
  const ratingAnswers = answers.filter((a) => a.rating != null)
  const textAnswers = answers.filter((a) => a.textAnswer && a.textAnswer.trim())
  return (
    <div className="space-y-2 mt-2">
      {ratingAnswers.map((a) => (
        <div key={a.questionId} className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant">{a.questionText}</span>
          <span className="font-bold text-on-surface font-mono">{a.rating}/5</span>
        </div>
      ))}
      {textAnswers.map((a) => (
        <div key={a.questionId + '-text'} className="text-sm">
          <div className="text-on-surface-variant text-xs mb-1">{a.questionText}</div>
          <div className="text-on-surface rounded-xl bg-surface-container-high px-3 py-2 text-sm">
            {a.textAnswer}
          </div>
        </div>
      ))}
    </div>
  )
}

function AttributedCard({ review }: { review: AttributedReview }) {
  return (
    <div className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-on-surface text-sm">{review.reviewer.name}</div>
          <div className="text-xs text-on-surface-variant">{review.reviewer.email}</div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold uppercase">
          {review.reviewType}
        </span>
      </div>
      <AnswerList answers={review.answers} />
    </div>
  )
}

function AnonSection({
  section,
  label,
}: {
  section: AnonymousSection | WithheldSection
  label: string
}) {
  if (section.withheld) {
    return (
      <div className="rounded-2xl bg-surface-container border border-outline-variant p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-on-surface text-sm">{label} reviews withheld</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              {section.count} of {section.threshold} required. Reviews are hidden until the minimum threshold is reached.
              {section.aggregated.avgRating != null && (
                <> Average rating so far: <span className="font-bold">{section.aggregated.avgRating}/5</span></>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {section.reviews.map((r, i) => (
        <div key={i} className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant font-medium italic">Anonymous {label} review</span>
            <span className="text-xs px-2 py-1 rounded-full bg-surface-container text-on-surface-variant font-semibold uppercase">
              {r.reviewType}
            </span>
          </div>
          <AnswerList answers={r.answers} />
        </div>
      ))}
    </div>
  )
}

export default function ReceivedReviewsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const cycleParam = searchParams.get('cycleId')

  const [user, setUser] = useState<User | null>(null)
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState(cycleParam || '')
  const [data, setData] = useState<ReceivedReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingReviews, setFetchingReviews] = useState(false)
  const [error, setError] = useState('')
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    Promise.all([
      getCurrentUser(),
      reviewCyclesApi.getAll(),
    ])
      .then(([u, { data: allCycles }]) => {
        setUser(u)
        const completedCycles = allCycles.filter((c: ReviewCycle) => c.status === 'COMPLETED')
        setCycles(completedCycles)
        if (!selectedCycleId && completedCycles.length > 0) {
          setSelectedCycleId(completedCycles[0].id)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedCycleId) return
    setFetchingReviews(true)
    setData(null)
    getMyReceivedReviews(selectedCycleId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setFetchingReviews(false))
  }, [selectedCycleId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  const hasSelf = (data?.self ?? []).length > 0
  const hasManager = (data?.manager ?? []).length > 0
  const hasPeer = data?.peer != null
  const hasUpward = data?.upward != null

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">My Reviews</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Reviews written about you, visible after the cycle closes. Peer reviews are anonymous.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Cycle selector */}
      {cycles.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-outline-variant p-8 text-center text-on-surface-variant text-sm">
          No completed review cycles yet. Reviews become available when a cycle closes.
        </div>
      ) : (
        <div className="rounded-2xl bg-surface border border-outline-variant p-4">
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="w-full rounded-xl border border-outline bg-surface-container px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {fetchingReviews && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {data?.locked && (
        <div className="rounded-2xl bg-surface-container border border-outline-variant p-6 text-center">
          <div className="text-on-surface-variant text-sm">
            Reviews are locked until this cycle is completed.
          </div>
        </div>
      )}

      {data && !data.locked && (
        <div className="space-y-8">
          {/* Self */}
          {hasSelf && (
            <section className="space-y-3">
              <h2 className="font-semibold text-on-surface">Self Review</h2>
              {data.self!.map((r, i) => <AttributedCard key={i} review={r} />)}
            </section>
          )}

          {/* Downward (attributed — manager reviewing report) */}
          {hasManager && (
            <section className="space-y-3">
              <h2 className="font-semibold text-on-surface">Downward Reviews</h2>
              {data.manager!.map((r, i) => <AttributedCard key={i} review={r} />)}
            </section>
          )}

          {/* Peer (anonymous) */}
          {hasPeer && (
            <section className="space-y-3">
              <h2 className="font-semibold text-on-surface">
                Peer Reviews
                <span className="ml-2 text-xs font-normal text-on-surface-variant">(anonymous)</span>
              </h2>
              <AnonSection section={data.peer!} label="Peer" />
            </section>
          )}

          {/* Upward (anonymous) */}
          {hasUpward && (
            <section className="space-y-3">
              <h2 className="font-semibold text-on-surface">
                Upward Reviews
                <span className="ml-2 text-xs font-normal text-on-surface-variant">(from direct reports, anonymous)</span>
              </h2>
              <AnonSection section={data.upward!} label="Upward" />
            </section>
          )}

          {!hasSelf && !hasManager && !hasPeer && !hasUpward && (
            <div className="rounded-2xl bg-surface border border-outline-variant p-8 text-center text-on-surface-variant text-sm">
              No submitted reviews found for this cycle.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
