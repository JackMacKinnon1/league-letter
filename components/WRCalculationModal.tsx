'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Calculator, Info, Target, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { WR_CORRELATION_DATASET, WR_PREDICTION_CORRELATIONS } from '@/lib/wrPredictionCorrelations'
import type { WRPredictiveMetric } from '@/lib/wrPredictionCorrelations'

type MetricWeights = {
  yprr?: number
  pff?: number
  yards?: number
  firstRead?: number
  targetShare?: number
  mtfPerRec?: number
}

type CalculationWeights = {
  metricWeights?: MetricWeights
  seasonWeights?: {
    current?: number
    previous?: number
    twoAgo?: number
  }
  missingSeasonScore?: number
  eliteThreshold?: number
  eliteBoost?: number
  eliteDecay?: {
    current?: number
    previous?: number
    twoAgo?: number
  }
  ageBoostCap?: number
  maxScore?: number
}

type ChartView = 'correlation' | 'rSquared'

const DEFAULT_WEIGHTS = {
  metricWeights: {
    yards: 0.45,
    yprr: 0.25,
    pff: 0.15,
    firstRead: 0.1,
    targetShare: 0.05,
  },
  seasonWeights: {
    current: 0.6,
    previous: 0.25,
    twoAgo: 0.15,
  },
  missingSeasonScore: 3500,
  eliteThreshold: 9000,
  eliteBoost: 0.08,
  eliteDecay: {
    current: 1,
    previous: 0.7,
    twoAgo: 0.4,
  },
  ageBoostCap: 500,
  maxScore: 9999,
}

const MODEL_METRICS = [
  {
    key: 'yards',
    label: 'Receiving yards / game',
    source: 'RecYDS/G',
    description: 'Production and weekly volume.',
  },
  {
    key: 'yprr',
    label: 'Yards per route run',
    source: 'YPRR',
    description: 'Efficiency on every route run.',
  },
  {
    key: 'pff',
    label: 'PFF route grade',
    source: 'grades_pass_route',
    description: 'PFF’s grade for pass-route performance.',
  },
  {
    key: 'firstRead',
    label: 'First-read share',
    source: '1READ %',
    description: 'How often the receiver is the designed first option.',
  },
  {
    key: 'targetShare',
    label: 'Target share',
    source: 'TGT %',
    description: 'The share of team pass attempts directed at the receiver.',
  },
] as const

export default function WRCalculationModal({
  onClose,
  weights,
}: {
  onClose: () => void
  weights?: CalculationWeights | null
}) {
  const [chartView, setChartView] = useState<ChartView>('correlation')
  const [activeMetricKey, setActiveMetricKey] = useState('targetShare')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const isLegacyUpload = Boolean(
    weights?.metricWeights?.mtfPerRec !== undefined &&
    weights?.metricWeights?.targetShare === undefined
  )

  const resolvedWeights = useMemo(() => {
    const metricWeights = weights?.metricWeights || {}
    const seasonWeights = weights?.seasonWeights || {}
    const eliteDecay = weights?.eliteDecay || {}

    return {
      metricWeights: {
        yards: finiteOr(metricWeights.yards, DEFAULT_WEIGHTS.metricWeights.yards),
        yprr: finiteOr(metricWeights.yprr, DEFAULT_WEIGHTS.metricWeights.yprr),
        pff: finiteOr(metricWeights.pff, DEFAULT_WEIGHTS.metricWeights.pff),
        firstRead: finiteOr(metricWeights.firstRead, DEFAULT_WEIGHTS.metricWeights.firstRead),
        targetShare: finiteOr(metricWeights.targetShare, DEFAULT_WEIGHTS.metricWeights.targetShare),
      },
      seasonWeights: {
        current: finiteOr(seasonWeights.current, DEFAULT_WEIGHTS.seasonWeights.current),
        previous: finiteOr(seasonWeights.previous, DEFAULT_WEIGHTS.seasonWeights.previous),
        twoAgo: finiteOr(seasonWeights.twoAgo, DEFAULT_WEIGHTS.seasonWeights.twoAgo),
      },
      missingSeasonScore: finiteOr(weights?.missingSeasonScore, DEFAULT_WEIGHTS.missingSeasonScore),
      eliteThreshold: finiteOr(weights?.eliteThreshold, DEFAULT_WEIGHTS.eliteThreshold),
      eliteBoost: finiteOr(weights?.eliteBoost, DEFAULT_WEIGHTS.eliteBoost),
      eliteDecay: {
        current: finiteOr(eliteDecay.current, DEFAULT_WEIGHTS.eliteDecay.current),
        previous: finiteOr(eliteDecay.previous, DEFAULT_WEIGHTS.eliteDecay.previous),
        twoAgo: finiteOr(eliteDecay.twoAgo, DEFAULT_WEIGHTS.eliteDecay.twoAgo),
      },
      ageBoostCap: finiteOr(weights?.ageBoostCap, DEFAULT_WEIGHTS.ageBoostCap),
      maxScore: finiteOr(weights?.maxScore, DEFAULT_WEIGHTS.maxScore),
    }
  }, [weights])

  const metricWeightTotal = Object.values(resolvedWeights.metricWeights).reduce(
    (total, value) => total + Math.max(value, 0),
    0
  )
  const seasonWeightTotal = Object.values(resolvedWeights.seasonWeights).reduce(
    (total, value) => total + Math.max(value, 0),
    0
  )

  const activeMetric = WR_PREDICTION_CORRELATIONS.find(
    (metric) => metric.key === activeMetricKey
  ) || WR_PREDICTION_CORRELATIONS[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-md sm:px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wr-calculation-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-zinc-700 bg-zinc-950 shadow-[0_32px_120px_rgba(0,0,0,0.65)]"
      >
        <header className="relative overflow-hidden border-b border-zinc-800 bg-white/[0.04] p-5 sm:p-7">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-zinc-950 sm:flex">
                <Calculator size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                  WR Valuator methodology
                </p>
                <h2 id="wr-calculation-title" className="mt-2 text-3xl font-black text-white sm:text-4xl">
                  How is this calculated?
                </h2>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-zinc-400">
                  Every season is graded against other receivers, blended across three years, and then adjusted for elite seasons, missing years, and age. The chart below tests how each stat relates to next-season fantasy production.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close calculation explanation"
              className="shrink-0 rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-300 transition hover:border-emerald-300 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="max-h-[calc(94vh-150px)] overflow-y-auto p-4 sm:p-7">
          {isLegacyUpload && (
            <div className="mb-5 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              <Info className="mt-0.5 shrink-0 text-amber-300" size={18} />
              <p>
                This selected upload was created with the previous <strong>MTF/REC</strong> model. Its saved scores will not change automatically. Upload the WR workbook again to recalculate it with <strong>target share</strong>.
              </p>
            </div>
          )}

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <Target size={19} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">1. Build a season score</h3>
                  <p className="text-sm text-zinc-500">Each metric becomes a percentile within that season.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {MODEL_METRICS.map((metric) => {
                  const weight = resolvedWeights.metricWeights[metric.key]
                  const normalizedWeight = metricWeightTotal > 0 ? weight / metricWeightTotal : 0

                  return (
                    <div key={metric.key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{metric.label}</p>
                          <p className="mt-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-300">
                            {metric.source}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-black text-emerald-200">
                          {formatPercent(normalizedWeight)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-medium leading-5 text-zinc-500">{metric.description}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-400">
                The five weighted percentiles are normalized by their total weight, combined, and scaled to a <strong className="text-white">0–9,999</strong> season score. The final ranking is capped at <strong className="text-white">{resolvedWeights.maxScore.toLocaleString()}</strong>.
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="text-xl font-black text-white">2. Turn seasons into a ranking</h3>
              <div className="mt-4 space-y-3">
                <RuleRow
                  number="01"
                  title="Blend up to three seasons"
                  description={`${formatPercent(normalizeWeight(resolvedWeights.seasonWeights.current, seasonWeightTotal))} current, ${formatPercent(normalizeWeight(resolvedWeights.seasonWeights.previous, seasonWeightTotal))} previous, and ${formatPercent(normalizeWeight(resolvedWeights.seasonWeights.twoAgo, seasonWeightTotal))} two years ago.`}
                />
                <RuleRow
                  number="02"
                  title="Handle rookies and missed seasons"
                  description={`True rookies only use seasons they have played. For a veteran missing one of three years, the model uses the average of the other two; with only one real year it uses ${resolvedWeights.missingSeasonScore.toLocaleString()}.`}
                />
                <RuleRow
                  number="03"
                  title="Reward elite seasons"
                  description={`A season above ${resolvedWeights.eliteThreshold.toLocaleString()} can add up to ${formatPercent(resolvedWeights.eliteBoost)}, decaying to ${formatPercent(resolvedWeights.eliteBoost * resolvedWeights.eliteDecay.previous)} and ${formatPercent(resolvedWeights.eliteBoost * resolvedWeights.eliteDecay.twoAgo)} for older seasons.`}
                />
                <RuleRow
                  number="04"
                  title="Apply the age curve"
                  description={`The saved age multiplier is applied last. Positive age boosts are capped at ${resolvedWeights.ageBoostCap.toLocaleString()} ranking points.`}
                />
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[1.7rem] border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-emerald-300" size={20} />
                  <h3 className="text-2xl font-black text-white">Which stats predict future FP/G?</h3>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                  Pearson correlation compares each season’s stat with the receiver’s fantasy points per game in the following season. Tap or hover a bar for details.
                </p>
              </div>

              <div className="inline-flex self-start rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
                <ChartToggle
                  active={chartView === 'correlation'}
                  onClick={() => setChartView('correlation')}
                  label="Correlation"
                />
                <ChartToggle
                  active={chartView === 'rSquared'}
                  onClick={() => setChartView('rSquared')}
                  label="R²"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:p-5">
                <div className="mb-3 grid grid-cols-[minmax(115px,190px)_1fr_58px] gap-3 text-[0.62rem] font-black uppercase tracking-[0.15em] text-zinc-600 sm:grid-cols-[220px_1fr_70px]">
                  <span>Metric</span>
                  <div className="relative">
                    {chartView === 'correlation' ? (
                      <>
                        <span className="absolute left-0">-1</span>
                        <span className="absolute left-1/2 -translate-x-1/2">0</span>
                        <span className="absolute right-0">1</span>
                      </>
                    ) : (
                      <>
                        <span className="absolute left-0">0</span>
                        <span className="absolute left-1/2 -translate-x-1/2">0.5</span>
                        <span className="absolute right-0">1</span>
                      </>
                    )}
                  </div>
                  <span className="text-right">Value</span>
                </div>

                <div className="space-y-2">
                  {WR_PREDICTION_CORRELATIONS.map((metric) => (
                    <PredictionBar
                      key={metric.key}
                      metric={metric}
                      view={chartView}
                      active={activeMetric.key === metric.key}
                      onActivate={() => setActiveMetricKey(metric.key)}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-zinc-500">
                  <LegendDot className="bg-emerald-400" label="Used in WR model" />
                  <LegendDot className="bg-sky-400" label="Comparison stat" />
                  <LegendDot className="bg-red-400" label="Replaced stat" />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${chartView}-${activeMetric.key}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-zinc-950 p-5"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    Selected metric
                  </p>
                  <h4 className="mt-2 text-2xl font-black text-white">{activeMetric.label}</h4>
                  <p className="mt-1 font-mono text-xs font-bold text-zinc-500">{activeMetric.sourceColumn}</p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <ChartStat label="Correlation" value={formatDecimal(activeMetric.correlation)} />
                    <ChartStat label="R²" value={formatDecimal(activeMetric.rSquared)} />
                    <ChartStat label="Sample" value={activeMetric.sampleSize.toLocaleString()} />
                    <ChartStat label="Model" value={activeMetric.usedInModel ? 'Included' : activeMetric.status === 'replaced' ? 'Replaced' : 'Comparison'} />
                  </div>

                  <p className="mt-5 text-sm font-medium leading-6 text-zinc-400">{activeMetric.description}</p>

                  {activeMetric.key === 'targetShare' && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm font-bold leading-6 text-emerald-100">
                      Target share had a <strong>0.673</strong> correlation with following-year FP/G, compared with <strong>0.152</strong> for MTF/REC. That is why it replaced MTF/REC in the model.
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-medium leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Dataset: {WR_CORRELATION_DATASET.predictionSeasons} player-seasons · target: {WR_CORRELATION_DATASET.target} · method: {WR_CORRELATION_DATASET.method}.
              </span>
              <span>Correlation measures association, not causation.</span>
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}

function RuleRow({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-xs font-black text-emerald-300">
        {number}
      </span>
      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{description}</p>
      </div>
    </div>
  )
}

function ChartToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-xs font-black transition ${
        active ? 'bg-emerald-400 text-zinc-950' : 'text-zinc-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function PredictionBar({
  metric,
  view,
  active,
  onActivate,
}: {
  metric: WRPredictiveMetric
  view: ChartView
  active: boolean
  onActivate: () => void
}) {
  const value = view === 'correlation' ? metric.correlation : metric.rSquared
  const absoluteValue = Math.abs(value)
  const isCorrelation = view === 'correlation'
  const left = isCorrelation
    ? value >= 0
      ? 50
      : 50 - absoluteValue * 50
    : 0
  const width = isCorrelation ? absoluteValue * 50 : absoluteValue * 100
  const barClass = metric.status === 'replaced'
    ? 'bg-red-400'
    : metric.usedInModel
      ? 'bg-emerald-400'
      : 'bg-sky-400'

  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      className={`grid w-full grid-cols-[minmax(115px,190px)_1fr_58px] items-center gap-3 rounded-xl px-2 py-2 text-left transition sm:grid-cols-[220px_1fr_70px] ${
        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'
      }`}
    >
      <div className="min-w-0">
        <p className={`truncate text-xs font-black sm:text-sm ${active ? 'text-white' : 'text-zinc-400'}`}>
          {metric.label}
        </p>
        <p className="mt-0.5 hidden text-[0.62rem] font-bold uppercase tracking-[0.12em] text-zinc-600 sm:block">
          {metric.sourceColumn}
        </p>
      </div>

      <div className="relative h-7 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {isCorrelation && <div className="absolute bottom-0 left-1/2 top-0 w-px bg-zinc-600" />}
        <motion.div
          initial={false}
          animate={{ left: `${left}%`, width: `${Math.max(width, 0.75)}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          className={`absolute bottom-1 top-1 rounded-md ${barClass} ${active ? 'opacity-100' : 'opacity-75'}`}
        />
      </div>

      <p className={`text-right font-mono text-xs font-black sm:text-sm ${active ? 'text-white' : 'text-zinc-500'}`}>
        {view === 'correlation' ? formatDecimal(metric.correlation) : formatDecimal(metric.rSquared)}
      </p>
    </button>
  )
}

function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
      <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}

function finiteOr(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeWeight(value: number, total: number) {
  return total > 0 ? Math.max(value, 0) / total : 0
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`
}

function formatDecimal(value: number) {
  return value.toFixed(3)
}
