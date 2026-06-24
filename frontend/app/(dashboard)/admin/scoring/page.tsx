'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getScoreWeights,
  updateScoreWeights,
  ScoreWeightConfig,
} from '@/lib/score-weights'

function WeightSlider({
  label,
  value,
  onChange,
  color = 'bg-primary',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  color?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-on-surface">{label}</span>
        <span className="font-mono font-bold text-on-surface">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 rounded-full cursor-pointer"
      />
      <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ScorePreview({
  quantWeight,
  managerWeight,
  peerWeight,
  selfWeight,
}: {
  quantWeight: number
  managerWeight: number
  peerWeight: number
  selfWeight: number
}) {
  const qualWeight = 100 - quantWeight
  // Example: quant=4, manager=4.5, peer=3.8, self=4.2
  const exampleQuant = 4.0
  const exampleManager = 4.5
  const examplePeer = 3.8
  const exampleSelf = 4.2

  // Re-normalise qual weights
  const totalQual = managerWeight + peerWeight + selfWeight
  const mEff = totalQual > 0 ? managerWeight / totalQual : 0
  const pEff = totalQual > 0 ? peerWeight / totalQual : 0
  const sEff = totalQual > 0 ? selfWeight / totalQual : 0
  const qualScore = exampleManager * mEff + examplePeer * pEff + exampleSelf * sEff

  const totalW = quantWeight + qualWeight
  const finalScore =
    totalW > 0
      ? (exampleQuant * (quantWeight / totalW) + qualScore * (qualWeight / totalW))
      : 0

  return (
    <div className="rounded-2xl bg-surface-container p-5 space-y-3">
      <h3 className="font-semibold text-on-surface text-sm">Live Preview (example scores)</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="text-on-surface-variant text-xs mb-1">Quant ({quantWeight}%)</div>
          <div className="font-bold text-on-surface">{exampleQuant.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="text-on-surface-variant text-xs mb-1">Qual ({qualWeight}%)</div>
          <div className="font-bold text-on-surface">{qualScore.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="text-on-surface-variant text-xs mb-1">Manager ({managerWeight}%)</div>
          <div className="font-bold text-on-surface">{exampleManager.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="text-on-surface-variant text-xs mb-1">Peer ({peerWeight}%)</div>
          <div className="font-bold text-on-surface">{examplePeer.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="text-on-surface-variant text-xs mb-1">Self ({selfWeight}%)</div>
          <div className="font-bold text-on-surface">{exampleSelf.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
          <div className="text-primary text-xs mb-1 font-semibold">Final Score</div>
          <div className="font-bold text-primary text-lg">{finalScore.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}

export default function ScoringWeightsPage() {
  const [config, setConfig] = useState<ScoreWeightConfig | null>(null)
  const [quantWeight, setQuantWeight] = useState(50)
  const [managerWeight, setManagerWeight] = useState(60)
  const [peerWeight, setPeerWeight] = useState(30)
  const [selfWeight, setSelfWeight] = useState(10)
  const [minPeerThreshold] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    getScoreWeights()
      .then((cfg) => {
        setConfig(cfg)
        setQuantWeight(cfg.quantWeight)
        setManagerWeight(cfg.managerWeight)
        setPeerWeight(cfg.peerWeight)
        setSelfWeight(cfg.selfWeight)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const qualSum = managerWeight + peerWeight + selfWeight
  const qualValid = qualSum === 100
  const quantValid = quantWeight >= 0 && quantWeight <= 100
  const canSave = qualValid && quantValid

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const updated = await updateScoreWeights({
        quantWeight,
        managerWeight,
        peerWeight,
        selfWeight,
        minPeerThreshold,
      })
      setConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Scoring Weights</h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          Configure how final performance scores are calculated. Changes apply to all future score calculations.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Quant / Qual split */}
      <div className="rounded-2xl bg-surface border border-outline-variant p-6 space-y-5">
        <h2 className="font-semibold text-on-surface">Quantitative vs Qualitative</h2>
        <p className="text-sm text-on-surface-variant">
          Quant score is the mean of each employee's departments' scores (set per department under each cycle's Quant Scores page). Qual score is the weighted average of manager, peer, and self reviews.
        </p>
        <WeightSlider
          label="Quantitative weight"
          value={quantWeight}
          onChange={setQuantWeight}
          color="bg-tertiary"
        />
        <div className="text-sm text-on-surface-variant">
          Qualitative weight: <span className="font-bold text-on-surface">{100 - quantWeight}%</span>
        </div>
      </div>

      {/* Qual sub-weights */}
      <div className="rounded-2xl bg-surface border border-outline-variant p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-on-surface">Qualitative Source Weights</h2>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              qualValid
                ? 'bg-primary/10 text-primary'
                : 'bg-error/10 text-error'
            }`}
          >
            Sum: {qualSum}% {qualValid ? '✓' : `— need ${100 - qualSum < 0 ? '' : '+'}${100 - qualSum}%`}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant">
          Weights must sum to 100%. Missing sources are re-normalised automatically — weight is never wasted.
        </p>
        <WeightSlider
          label="Manager review weight"
          value={managerWeight}
          onChange={setManagerWeight}
          color="bg-secondary"
        />
        <WeightSlider
          label="Peer review weight"
          value={peerWeight}
          onChange={setPeerWeight}
          color="bg-secondary"
        />
        <WeightSlider
          label="Self review weight"
          value={selfWeight}
          onChange={setSelfWeight}
          color="bg-secondary"
        />
      </div>

      {/* Live preview */}
      <ScorePreview
        quantWeight={quantWeight}
        managerWeight={managerWeight}
        peerWeight={peerWeight}
        selfWeight={selfWeight}
      />

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save weights'}
        </button>
        {saved && (
          <span className="text-sm text-primary font-medium">Saved successfully</span>
        )}
        {config && (
          <button
            onClick={() => {
              setQuantWeight(config.quantWeight)
              setManagerWeight(config.managerWeight)
              setPeerWeight(config.peerWeight)
              setSelfWeight(config.selfWeight)
            }}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Reset to saved
          </button>
        )}
      </div>
    </div>
  )
}
