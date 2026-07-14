import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { format, parseISO, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  fetchRunningStats,
  type Acwr,
  type DayForm,
  type DurationCheckpoint,
  type MonthEfficiency,
  type RoadPrediction,
  type TrailEstimate,
  type WeekEffort,
  type WeekVolume,
} from '../athlete/api'
import { GymStatsSection } from '../gym/GymStatsSection'

const muted = 'text-moss-500 dark:text-moss-400'
const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'

const RANGES = [1, 3, 6, 12] as const
type RangeMonths = (typeof RANGES)[number]

export function formatChrono(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`
}

/** The statistics home: running on one side, strength on the other. */
export function StatsPage() {
  const search = useSearch({ strict: false }) as { tab?: string }
  const navigate = useNavigate()
  const tab: 'course' | 'renfo' = search.tab === 'renfo' ? 'renfo' : 'course'

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Statistiques</h1>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {(['course', 'renfo'] as const).map((value) => (
            <button
              key={value}
              onClick={() => void navigate({ to: '/stats', search: { tab: value } })}
              aria-pressed={tab === value}
              className={`rounded-md px-3.5 py-1 text-sm font-medium transition ${
                tab === value
                  ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
                  : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
              }`}
            >
              {value === 'course' ? 'Course' : 'Renfo'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'course' ? <RunningStats /> : <GymStatsSection />}
    </div>
  )
}

/* ── Course ────────────────────────────────────────────────────────── */

function RunningStats() {
  const [months, setMonths] = useState<RangeMonths>(3)
  const query = useQuery({ queryKey: ['running-stats'], queryFn: fetchRunningStats })

  const stats = query.data
  const cutoff = useMemo(() => subMonths(new Date(), months), [months])

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>Chargement…</p>
  }
  if (!stats) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">
        Impossible de charger les statistiques.
      </p>
    )
  }

  const inRange = (date: string) => parseISO(date) >= cutoff
  const form = stats.form.filter((d) => inRange(d.date))
  const effort = stats.weeklyEffort.filter((w) => inRange(w.weekStart))
  const volume = stats.weeklyVolume.filter((w) => inRange(w.weekStart))
  const efficiency = stats.efficiency.slice(-months)

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>Période</span>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setMonths(r)}
              aria-pressed={months === r}
              className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${
                months === r
                  ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
                  : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
              }`}
            >
              {r} mois
            </button>
          ))}
        </div>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Forme & Fitness</h2>
          <AcwrChip acwr={stats.acwr} />
        </div>
        <p className={`mt-0.5 text-xs ${muted}`}>
          Fitness = effort relatif lissé sur 42 j, Fatigue sur 7 j, Forme = différence.
        </p>
        <div className="mt-3">
          <FormChart days={form} />
        </div>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">Effort relatif hebdo</h2>
        <p className={`mt-0.5 text-xs ${muted}`}>
          La zone ombrée est ta cible de progression : 0,8–1,3 × la moyenne des 3 dernières
          semaines.
        </p>
        <div className="mt-3">
          <EffortBandChart weeks={effort} />
        </div>
        <EffortStatus weeks={stats.weeklyEffort} />
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">Volume</h2>
        <p className={`mt-0.5 text-xs ${muted}`}>
          Barres : km — ligne : D+. Le total km-effort (km + D+/100) est la vraie monnaie du
          trail.
        </p>
        <div className="mt-3">
          <VolumeChart weeks={volume} />
        </div>
        <VolumeTotals weeks={volume} />
      </section>

      {stats.checkpoints.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Après X minutes de course…</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Où tu te trouves typiquement (médianes de tes sorties, flux Strava inclus).
          </p>
          <CheckpointsTable checkpoints={stats.checkpoints} />
        </section>
      )}

      {efficiency.some((m) => m.metersPerBeat != null) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Efficience aérobie</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Mètres parcourus par battement de cœur — plus haut = plus efficace au même effort.
          </p>
          <div className="mt-3">
            <EfficiencyChart months={efficiency} />
          </div>
        </section>
      )}

      {(stats.trailEstimates.length > 0 || stats.roadPredictions.length > 0) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Prédictions</h2>
          {stats.trailEstimates.length > 0 && (
            <TrailEstimates estimates={stats.trailEstimates} />
          )}
          {stats.roadPredictions.length > 0 && (
            <RoadPredictions predictions={stats.roadPredictions} />
          )}
        </section>
      )}
    </>
  )
}

/* ── ACWR chip ─────────────────────────────────────────────────────── */

const ACWR_STYLE: Record<Acwr['zone'], { label: string; className: string }> = {
  UNDER: { label: 'sous-charge', className: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300' },
  OPTIMAL: { label: 'zone optimale', className: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300' },
  CAUTION: { label: 'prudence', className: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300' },
  DANGER: { label: 'risque de blessure', className: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300' },
}

function AcwrChip({ acwr }: { acwr: Acwr }) {
  const style = ACWR_STYLE[acwr.zone]
  return (
    <span
      title="Ratio charge aiguë (7 j) / chronique (28 j). Zone saine : 0,8–1,3 ; danger au-delà de 1,5."
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
    >
      Charge 7j/28j : {acwr.ratio.toFixed(2)} · {style.label}
    </span>
  )
}

/* ── Charts (shared frame) ─────────────────────────────────────────── */

const W = 640
const H = 210
const PAD = { top: 14, right: 44, bottom: 22, left: 44 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

function xScale(count: number): (i: number) => number {
  return (i) => (count <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (count - 1))
}

function GridY({ ticks, y, format: fmt }: { ticks: number[]; y: (v: number) => number; format?: (v: number) => string }) {
  return (
    <>
      {[...new Set(ticks)].map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
            className="stroke-moss-200 dark:stroke-moss-750" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {fmt ? fmt(t) : Math.round(t)}
          </text>
        </g>
      ))}
    </>
  )
}

/* ── Forme & Fitness: three series in one frame ────────────────────── */

function FormChart({ days }: { days: DayForm[] }) {
  if (days.length < 2) return <p className={`text-sm ${muted}`}>Pas encore assez de données.</p>
  const values = days.flatMap((d) => [d.fitness, d.fatigue, d.formScore])
  const lo = Math.min(...values, 0)
  const hi = Math.max(...values) * 1.1 || 1
  const x = xScale(days.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = (value: (d: DayForm) => number) =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(value(d))}`).join(' ')

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Forme et fitness">
        <GridY ticks={[0, hi * 0.5]} y={y} />
        {/* form area under zero shows accumulated fatigue */}
        <path d={`${path((d) => d.formScore)} L ${x(days.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
          className="fill-pine-600/10 dark:fill-pine-350/10" />
        <path d={path((d) => d.fitness)} fill="none" strokeWidth={2}
          className="stroke-pine-600 dark:stroke-pine-350" />
        <path d={path((d) => d.fatigue)} fill="none" strokeWidth={1.5} strokeDasharray="4 3"
          className="stroke-clay-500 dark:stroke-clay-300" />
        <path d={path((d) => d.formScore)} fill="none" strokeWidth={1.5}
          className="stroke-lake-600 dark:stroke-lake-300" />
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {format(parseISO(days[i].date), 'd MMM', { locale: fr })}
          </text>
        ))}
      </svg>
      <div className={`mt-1 flex flex-wrap gap-3 text-xs ${muted}`}>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-pine-600 dark:bg-pine-350" />Fitness {days.at(-1)!.fitness}</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-clay-500 dark:bg-clay-300" />Fatigue {days.at(-1)!.fatigue}</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-lake-600 dark:bg-lake-300" />Forme {days.at(-1)!.formScore}</span>
      </div>
    </>
  )
}

/* ── Weekly effort with the target band ────────────────────────────── */

function EffortBandChart({ weeks }: { weeks: WeekEffort[] }) {
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>Pas encore de données.</p>
  const hi = Math.max(...weeks.flatMap((w) => [w.effort, w.bandHigh ?? 0]), 1) * 1.1
  const y = (v: number) => PAD.top + (1 - v / hi) * plotH
  const barW = plotW / weeks.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label="Effort relatif hebdomadaire et zone cible">
      <GridY ticks={[hi * 0.3, hi * 0.7]} y={y} />
      {/* the band, drawn as a continuous ribbon behind the bars */}
      {weeks.map((week, i) =>
        week.bandLow != null && week.bandHigh != null ? (
          <rect key={`band-${week.weekStart}`} x={PAD.left + i * barW} width={barW}
            y={y(week.bandHigh)} height={Math.max(1, y(week.bandLow) - y(week.bandHigh))}
            className="fill-pine-600/15 dark:fill-pine-350/15" />
        ) : null,
      )}
      {weeks.map((week, i) => {
        const inBand = week.bandLow != null && week.bandHigh != null
            && week.effort >= week.bandLow && week.effort <= week.bandHigh
        const over = week.bandHigh != null && week.effort > week.bandHigh
        return (
          <rect key={week.weekStart} x={PAD.left + i * barW + barW * 0.22} width={barW * 0.56}
            y={y(week.effort)} height={Math.max(1, plotH + PAD.top - y(week.effort))} rx={2}
            className={over
              ? 'fill-clay-500 dark:fill-clay-300'
              : inBand
                ? 'fill-pine-600 dark:fill-pine-350'
                : 'fill-moss-400 dark:fill-moss-500'} />
        )
      })}
      {weeks.filter((_, i) => i % Math.ceil(weeks.length / 6) === 0).map((week) => (
        <text key={week.weekStart}
          x={PAD.left + weeks.indexOf(week) * barW + barW / 2} y={H - 6} textAnchor="middle"
          className="fill-moss-500 text-[10px] dark:fill-moss-400">
          {format(parseISO(week.weekStart), 'd MMM', { locale: fr })}
        </text>
      ))}
    </svg>
  )
}

function EffortStatus({ weeks }: { weeks: WeekEffort[] }) {
  const current = weeks.at(-1)
  if (!current || current.bandLow == null || current.bandHigh == null) return null
  const status = current.effort > current.bandHigh
    ? 'au-dessus de la zone — pense à lever le pied'
    : current.effort >= current.bandLow
      ? 'dans la zone — progression saine'
      : `vise ${current.bandLow}–${current.bandHigh} d'ici dimanche`
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      Cette semaine : <span className="font-semibold text-ink dark:text-linen">{current.effort}</span>{' '}
      · {status}
      {current.partlyEstimated && ' · (sorties sans FC estimées)'}
    </p>
  )
}

/* ── Volume: km bars + D+ line, two axes ───────────────────────────── */

function VolumeChart({ weeks }: { weeks: WeekVolume[] }) {
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>Pas encore de données.</p>
  const maxKm = Math.max(...weeks.map((w) => w.distanceKm), 1)
  const maxD = Math.max(...weeks.map((w) => w.elevationM), 1)
  const yKm = (v: number) => PAD.top + (1 - v / (maxKm * 1.1)) * plotH
  const yD = (v: number) => PAD.top + (1 - v / (maxD * 1.15)) * plotH
  const barW = plotW / weeks.length
  const linePath = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'} ${PAD.left + i * barW + barW / 2} ${yD(w.elevationM)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label="Volume hebdomadaire : kilomètres et dénivelé">
      <GridY ticks={[maxKm * 0.5, maxKm]} y={yKm} format={(v) => `${Math.round(v)}k`} />
      {/* right axis for D+ */}
      {[maxD].map((t) => (
        <text key={t} x={W - PAD.right + 6} y={yD(t) + 3} textAnchor="start"
          className="fill-lake-600 text-[10px] dark:fill-lake-300">
          {Math.round(t)}m
        </text>
      ))}
      {weeks.map((week, i) => (
        <rect key={week.weekStart} x={PAD.left + i * barW + barW * 0.2} width={barW * 0.6}
          y={yKm(week.distanceKm)} height={Math.max(1, plotH + PAD.top - yKm(week.distanceKm))}
          rx={2} className="fill-pine-600 dark:fill-pine-350" />
      ))}
      <path d={linePath} fill="none" strokeWidth={2}
        className="stroke-lake-600 dark:stroke-lake-300" />
      {weeks.filter((_, i) => i % Math.ceil(weeks.length / 6) === 0).map((week) => (
        <text key={week.weekStart}
          x={PAD.left + weeks.indexOf(week) * barW + barW / 2} y={H - 6} textAnchor="middle"
          className="fill-moss-500 text-[10px] dark:fill-moss-400">
          {format(parseISO(week.weekStart), 'd MMM', { locale: fr })}
        </text>
      ))}
    </svg>
  )
}

function VolumeTotals({ weeks }: { weeks: WeekVolume[] }) {
  const km = weeks.reduce((sum, w) => sum + Number(w.distanceKm), 0)
  const elevation = weeks.reduce((sum, w) => sum + w.elevationM, 0)
  const kmEffort = weeks.reduce((sum, w) => sum + Number(w.kmEffort), 0)
  const minutes = weeks.reduce((sum, w) => sum + w.durationMin, 0)
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      Total période :{' '}
      <span className="font-semibold text-ink dark:text-linen">{Math.round(km)} km</span> ·{' '}
      {elevation.toLocaleString('fr-FR')} m D+ · {formatChrono(minutes * 60)} ·{' '}
      <span className="font-semibold text-ink dark:text-linen">{Math.round(kmEffort)} km-effort</span>
    </p>
  )
}

/* ── Checkpoints table ─────────────────────────────────────────────── */

function CheckpointsTable({ checkpoints }: { checkpoints: DurationCheckpoint[] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {checkpoints.map((cp) => (
        <div key={cp.minutes}
          className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
          <p className={`text-xs font-semibold uppercase ${muted}`}>
            {cp.minutes >= 60 ? formatChrono(cp.minutes * 60) : `${cp.minutes} min`}
          </p>
          <p className="mt-1 text-xl font-semibold">{cp.medianDistanceKm} km</p>
          <p className={`text-xs ${muted}`}>
            {cp.medianElevationM ?? 0} m D+
            {cp.medianPaceSecPerKm != null && ` · ${formatPace(cp.medianPaceSecPerKm)}`}
          </p>
          <p className={`mt-1 text-[10px] ${muted}`}>{cp.samples} sorties</p>
        </div>
      ))}
    </div>
  )
}

/* ── Efficiency ────────────────────────────────────────────────────── */

function EfficiencyChart({ months }: { months: MonthEfficiency[] }) {
  const points = months.filter((m) => m.metersPerBeat != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>Pas encore assez de données FC.</p>
  const values = points.map((m) => m.metersPerBeat!)
  const lo = Math.min(...values) * 0.97
  const hi = Math.max(...values) * 1.03
  const x = xScale(points.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = points.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.metersPerBeat!)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Efficience aérobie">
      <GridY ticks={[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]} y={y}
        format={(v) => v.toFixed(2)} />
      <path d={path} fill="none" strokeWidth={2} className="stroke-pine-600 dark:stroke-pine-350" />
      {points.map((m, i) => (
        <g key={m.month}>
          <circle cx={x(i)} cy={y(m.metersPerBeat!)} r={3}
            className="fill-pine-600 dark:fill-pine-350" />
          <text x={x(i)} y={H - 6} textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {format(parseISO(`${m.month}-01`), 'MMM', { locale: fr })}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ── Predictions ───────────────────────────────────────────────────── */

function TrailEstimates({ estimates }: { estimates: TrailEstimate[] }) {
  return (
    <div className="mt-3 space-y-2">
      {estimates.map((estimate) => (
        <div key={`${estimate.objectiveName}-${estimate.date}`}
          className="rounded-lg border border-copper-600/30 bg-copper-600/5 p-3 dark:border-copper-300/30 dark:bg-copper-300/10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {estimate.objectiveName}
              <span className={`ml-2 text-xs ${muted}`}>
                {format(parseISO(estimate.date), 'd MMM yyyy', { locale: fr })} ·{' '}
                {estimate.distanceKm} km
                {estimate.elevationM != null && ` · ${estimate.elevationM} m D+`} ·{' '}
                {estimate.kmEffort} km-effort
              </span>
            </p>
            <p className="text-lg font-semibold text-copper-600 dark:text-copper-300">
              {formatChrono(estimate.midSec)}
              <span className={`ml-1.5 text-xs font-normal ${muted}`}>
                ({formatChrono(estimate.lowSec)} – {formatChrono(estimate.highSec)})
              </span>
            </p>
          </div>
          <p className={`mt-1 text-xs ${muted}`}>
            D'après ton allure par km-effort sur {estimate.sampleRuns} sorties trail récentes,
            fatigue ultra incluse — pas un chrono garanti.
          </p>
        </div>
      ))}
    </div>
  )
}

function RoadPredictions({ predictions }: { predictions: RoadPrediction[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <p className={`mb-1 text-xs ${muted}`}>
        Sur route, une fourchette entre trois modèles — Riegel est optimiste au-delà du semi,
        Vickers-Vertosick tient compte de ton volume d'entraînement.
      </p>
      <table className="w-full min-w-105 text-sm">
        <thead>
          <tr className={`text-left text-xs uppercase ${muted}`}>
            <th className="py-1.5 pr-2 font-semibold">Distance</th>
            <th className="py-1.5 pr-2 font-semibold">Fourchette</th>
            <th className="py-1.5 pr-2 font-semibold">Record réel</th>
            <th className="py-1.5 font-semibold">Base</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((prediction) => {
            const models = [prediction.riegelSec, prediction.cameronSec, prediction.vickersSec]
              .filter((v): v is number => v != null)
            const low = Math.min(...models)
            const high = Math.max(...models)
            return (
              <tr key={prediction.label} className="border-t border-moss-200 dark:border-moss-750">
                <td className="py-2 pr-2 font-medium">{prediction.label}</td>
                <td className="py-2 pr-2 tabular-nums">
                  {formatChrono(low)} – {formatChrono(high)}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {prediction.recordSec != null ? formatChrono(prediction.recordSec) : '—'}
                </td>
                <td className={`py-2 text-xs ${muted}`}>{prediction.baseLabel}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
