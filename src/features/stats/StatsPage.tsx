import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { format, parseISO, subMonths } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale, numberLocale } from '../../i18n'
import {
  fetchRunningStats,
  type Acwr,
  type CriticalPace,
  type DayForm,
  type DurabilityPoint,
  type DurationCheckpoint,
  type MonthEfficiency,
  type RoadPrediction,
  type TrailEstimate,
  type Vo2maxPoint,
  type WeekEffort,
  type WeekMonotony,
  type WeekVolume,
} from '../athlete/api'
import { useAuth } from '../auth/session'
import { GymStatsSection } from '../gym/GymStatsSection'

const muted = 'text-moss-500 dark:text-moss-400'
const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'

const RANGES = [1, 3, 6, 12] as const
type RangeMonths = (typeof RANGES)[number]

function formatChrono(sec: number): string {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`
}

/** The statistics home: running on one side, strength on the other. */
export function StatsPage() {
  const { t } = useTranslation('stats')
  const search = useSearch({ strict: false }) as { tab?: string }
  const navigate = useNavigate()
  const gymEnabled = useAuth().user?.gymEnabled ?? true
  const tab: 'course' | 'renfo' = search.tab === 'renfo' && gymEnabled ? 'renfo' : 'course'

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {(gymEnabled ? (['course', 'renfo'] as const) : (['course'] as const)).map((value) => (
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
              {value === 'course' ? t('tabRunning') : t('tabStrength')}
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
  const { t } = useTranslation('stats')
  const [months, setMonths] = useState<RangeMonths>(3)
  const query = useQuery({ queryKey: ['running-stats'], queryFn: fetchRunningStats })

  const stats = query.data
  const cutoff = useMemo(() => subMonths(new Date(), months), [months])

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!stats) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">
        {t('loadError')}
      </p>
    )
  }

  const inRange = (date: string) => parseISO(date) >= cutoff
  const form = stats.form.filter((d) => inRange(d.date))
  const effort = stats.weeklyEffort.filter((w) => inRange(w.weekStart))
  const volume = stats.weeklyVolume.filter((w) => inRange(w.weekStart))
  const monotony = stats.monotony.filter((w) => inRange(w.weekStart))
  const efficiency = stats.efficiency.slice(-months)
  const vo2max = stats.vo2maxTrend.slice(-months)
  const durability = stats.durability.filter((p) => inRange(p.date))

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>{t('period')}</span>
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
              {t('months', { count: r })}
            </button>
          ))}
        </div>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{t('form.title')}</h2>
          <AcwrChip acwr={stats.acwr} />
        </div>
        <p className={`mt-0.5 text-xs ${muted}`}>
          {t('form.hint')}
        </p>
        <div className="mt-3">
          <FormChart days={form} />
        </div>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{t('effort.title')}</h2>
        <p className={`mt-0.5 text-xs ${muted}`}>
          {t('effort.hint')}
        </p>
        <div className="mt-3">
          <EffortBandChart weeks={effort} />
        </div>
        <EffortStatus weeks={stats.weeklyEffort} />
      </section>

      {stats.monotony.some((w) => w.monotony != null) && (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t('monotony.title')}</h2>
            <MonotonyChip monotony={stats.monotony} />
          </div>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('monotony.hint')}</p>
          <div className="mt-3">
            <MonotonyChart weeks={monotony} />
          </div>
        </section>
      )}

      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{t('volume.title')}</h2>
        <p className={`mt-0.5 text-xs ${muted}`}>
          {t('volume.hint')}
        </p>
        <div className="mt-3">
          <VolumeChart weeks={volume} />
        </div>
        <VolumeTotals weeks={volume} />
      </section>

      {stats.checkpoints.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('checkpoints.title')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            {t('checkpoints.hint')}
          </p>
          <CheckpointsTable checkpoints={stats.checkpoints} />
        </section>
      )}

      {efficiency.some((m) => m.metersPerBeat != null) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('efficiency.title')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            {t('efficiency.hint')}
          </p>
          <div className="mt-3">
            <EfficiencyChart months={efficiency} />
          </div>
        </section>
      )}

      {(stats.vo2maxTrend.some((m) => m.vo2max != null) || stats.criticalPace) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('vo2max.title')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('vo2max.hint')}</p>
          {stats.vo2maxTrend.some((m) => m.vo2max != null) && (
            <div className="mt-3">
              <Vo2maxChart months={vo2max} />
            </div>
          )}
          {stats.criticalPace && <CriticalPaceStat cp={stats.criticalPace} />}
        </section>
      )}

      {stats.durability.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('durability.title')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('durability.hint')}</p>
          <div className="mt-3">
            <DurabilityChart points={durability} />
          </div>
        </section>
      )}

      {(stats.trailEstimates.length > 0 || stats.roadPredictions.length > 0) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('predictions.title')}</h2>
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

const ACWR_STYLE: Record<Acwr['zone'], string> = {
  UNDER: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  OPTIMAL: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  CAUTION: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
  DANGER: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
}

function AcwrChip({ acwr }: { acwr: Acwr }) {
  const { t } = useTranslation('stats')
  return (
    <span
      title={t('acwr.tooltip')}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ACWR_STYLE[acwr.zone]}`}
    >
      {t('acwr.chip', { ratio: acwr.ratio.toFixed(2), zone: t(`acwr.zone.${acwr.zone}`) })}
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

/** Hover (desktop) / tap (mobile) details: invisible hit strips per index. */
function HitStrips({ count, onHover }: { count: number; onHover: (i: number | null) => void }) {
  const stripW = plotW / Math.max(1, count)
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={PAD.left + i * stripW}
          y={0}
          width={stripW}
          height={H}
          fill="transparent"
          onPointerEnter={() => onHover(i)}
          onPointerDown={() => onHover(i)}
        />
      ))}
    </>
  )
}

function ChartTooltip({ xRatio, lines }: { xRatio: number; lines: string[] }) {
  const leftHalf = xRatio < 0.5
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-max max-w-52 rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-xs shadow-sm dark:border-moss-750 dark:bg-moss-850"
      style={leftHalf ? { left: `${xRatio * 100 + 3}%` } : { right: `${(1 - xRatio) * 100 + 3}%` }}
    >
      {lines.map((line, i) => (
        <p key={i} className={i === 0 ? 'font-semibold' : 'text-moss-500 dark:text-moss-400'}>
          {line}
        </p>
      ))}
    </div>
  )
}

/* ── Forme & Fitness: three series in one frame ────────────────────── */

function FormChart({ days }: { days: DayForm[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  if (days.length < 2) return <p className={`text-sm ${muted}`}>{t('form.notEnough')}</p>
  const values = days.flatMap((d) => [d.fitness, d.fatigue, d.formScore])
  const lo = Math.min(...values, 0)
  const hi = Math.max(...values) * 1.1 || 1
  const x = xScale(days.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = (value: (d: DayForm) => number) =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(value(d))}`).join(' ')

  const hovered = hover != null ? days[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={(PAD.left + (hover! * plotW) / (days.length - 1)) / W}
          lines={[
            format(parseISO(hovered.date), 'EEEE d MMMM', { locale: dateLocale() }),
            `${t('form.fitness')} ${hovered.fitness}`,
            `${t('form.fatigue')} ${hovered.fatigue}`,
            `${t('form.form')} ${hovered.formScore}`,
          ]}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('form.aria')}>
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
            {format(parseISO(days[i].date), 'd MMM', { locale: dateLocale() })}
          </text>
        ))}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom}
            className="stroke-moss-400 dark:stroke-moss-500" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <HitStrips count={days.length} onHover={setHover} />
      </svg>
      <div className={`mt-1 flex flex-wrap gap-3 text-xs ${muted}`}>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-pine-600 dark:bg-pine-350" />{t('form.fitness')} {days.at(-1)!.fitness}</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-clay-500 dark:bg-clay-300" />{t('form.fatigue')} {days.at(-1)!.fatigue}</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded-sm bg-lake-600 dark:bg-lake-300" />{t('form.form')} {days.at(-1)!.formScore}</span>
      </div>
    </div>
  )
}

/* ── Weekly effort with the target band ────────────────────────────── */

function EffortBandChart({ weeks }: { weeks: WeekEffort[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>{t('effort.noData')}</p>
  const hi = Math.max(...weeks.flatMap((w) => [w.effort, w.bandHigh ?? 0]), 1) * 1.1
  const y = (v: number) => PAD.top + (1 - v / hi) * plotH
  const barW = plotW / weeks.length
  const hovered = hover != null ? weeks[hover] : null

  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={(PAD.left + hover! * barW + barW / 2) / W}
          lines={[
            t('effort.weekOf', { date: format(parseISO(hovered.weekStart), 'd MMMM', { locale: dateLocale() }) }),
            t('effort.relativeEffort', { value: hovered.effort }),
            hovered.bandLow != null
              ? t('effort.targetZone', { low: hovered.bandLow, high: hovered.bandHigh })
              : t('effort.targetZoneNone'),
            ...(hovered.partlyEstimated ? [t('effort.estimatedNote')] : []),
          ]}
        />
      )}
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={t('effort.aria')}>
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
          {format(parseISO(week.weekStart), 'd MMM', { locale: dateLocale() })}
        </text>
      ))}
      <HitStrips count={weeks.length} onHover={setHover} />
    </svg>
    </div>
  )
}

function EffortStatus({ weeks }: { weeks: WeekEffort[] }) {
  const { t } = useTranslation('stats')
  const current = weeks.at(-1)
  if (!current || current.bandLow == null || current.bandHigh == null) return null
  const status = current.effort > current.bandHigh
    ? t('effort.statusOver')
    : current.effort >= current.bandLow
      ? t('effort.statusIn')
      : t('effort.statusUnder', { low: current.bandLow, high: current.bandHigh })
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      {t('effort.thisWeek')} <span className="font-semibold text-ink dark:text-linen">{current.effort}</span>{' '}
      · {status}
      {current.partlyEstimated && ` · ${t('effort.estimatedNote')}`}
    </p>
  )
}

/* ── Monotony & strain (Foster) ────────────────────────────────────── */

/** The current week's monotony as a chip — clay once it crosses 2.0. */
function MonotonyChip({ monotony }: { monotony: WeekMonotony[] }) {
  const { t } = useTranslation('stats')
  const current = [...monotony].reverse().find((w) => w.monotony != null)
  if (!current || current.monotony == null) return null
  const style = current.flagged
    ? 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300'
    : 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300'
  return (
    <span title={t('monotony.tooltip')} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {t('monotony.chip', { value: current.monotony.toFixed(2) })}
    </span>
  )
}

/** Monotony per week as a line, with the 2.0 warning threshold; flagged weeks in clay. */
function MonotonyChart({ weeks }: { weeks: WeekMonotony[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  const points = weeks.filter((w) => w.monotony != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('monotony.notEnough')}</p>
  const maxM = Math.max(...points.map((w) => w.monotony!), 2.2)
  const x = xScale(weeks.length)
  const y = (v: number) => PAD.top + (1 - v / (maxM * 1.05)) * plotH

  let path = ''
  weeks.forEach((week, i) => {
    if (week.monotony == null) return
    const cmd = path === '' || weeks[i - 1]?.monotony == null ? 'M' : 'L'
    path += `${cmd} ${x(i)} ${y(week.monotony)} `
  })

  const hovered = hover != null ? weeks[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && hovered.monotony != null && (
        <ChartTooltip
          xRatio={x(hover!) / W}
          lines={[
            t('effort.weekOf', { date: format(parseISO(hovered.weekStart), 'd MMMM', { locale: dateLocale() }) }),
            t('monotony.value', { value: hovered.monotony.toFixed(2) }),
            t('monotony.strain', { value: hovered.strain ?? 0 }),
            ...(hovered.flagged ? [t('monotony.flagged')] : []),
          ]}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('monotony.aria')}>
        <GridY ticks={[maxM * 0.5]} y={y} format={(v) => v.toFixed(1)} />
        {/* the 2.0 overtraining threshold */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(2)} y2={y(2)} strokeWidth={1} strokeDasharray="4 3"
          className="stroke-clay-500/70 dark:stroke-clay-300/70" />
        <text x={W - PAD.right + 4} y={y(2) + 3} textAnchor="start"
          className="fill-clay-500 text-[10px] dark:fill-clay-300">2.0</text>
        <path d={path} fill="none" strokeWidth={2} className="stroke-pine-600 dark:stroke-pine-350" />
        {weeks.map((week, i) =>
          week.monotony == null ? null : (
            <circle key={week.weekStart} cx={x(i)} cy={y(week.monotony)} r={week.flagged ? 3.5 : 2.5}
              className={week.flagged
                ? 'fill-clay-500 dark:fill-clay-300'
                : 'fill-pine-600 dark:fill-pine-350'} />
          ),
        )}
        {weeks.filter((_, i) => i % Math.ceil(weeks.length / 6) === 0).map((week) => (
          <text key={week.weekStart}
            x={x(weeks.indexOf(week))} y={H - 6} textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {format(parseISO(week.weekStart), 'd MMM', { locale: dateLocale() })}
          </text>
        ))}
        <HitStrips count={weeks.length} onHover={setHover} />
      </svg>
    </div>
  )
}

/* ── Volume: km bars + D+ line, two axes ───────────────────────────── */

function VolumeChart({ weeks }: { weeks: WeekVolume[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>{t('effort.noData')}</p>
  const maxKm = Math.max(...weeks.map((w) => w.distanceKm), 1)
  const maxD = Math.max(...weeks.map((w) => w.elevationM), 1)
  const yKm = (v: number) => PAD.top + (1 - v / (maxKm * 1.1)) * plotH
  const yD = (v: number) => PAD.top + (1 - v / (maxD * 1.15)) * plotH
  const barW = plotW / weeks.length
  const linePath = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'} ${PAD.left + i * barW + barW / 2} ${yD(w.elevationM)}`)
    .join(' ')

  const hovered = hover != null ? weeks[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={(PAD.left + hover! * barW + barW / 2) / W}
          lines={[
            t('effort.weekOf', { date: format(parseISO(hovered.weekStart), 'd MMMM', { locale: dateLocale() }) }),
            t('volume.kmAndElevation', { km: hovered.distanceKm, elevation: hovered.elevationM }),
            `${t('volume.kmEffort', { value: hovered.kmEffort })} · ${t('volume.runs', { count: hovered.runs })}`,
            formatChrono(hovered.durationMin * 60),
          ]}
        />
      )}
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={t('volume.aria')}>
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
          {format(parseISO(week.weekStart), 'd MMM', { locale: dateLocale() })}
        </text>
      ))}
      <HitStrips count={weeks.length} onHover={setHover} />
    </svg>
    </div>
  )
}

function VolumeTotals({ weeks }: { weeks: WeekVolume[] }) {
  const { t } = useTranslation('stats')
  const km = weeks.reduce((sum, w) => sum + Number(w.distanceKm), 0)
  const elevation = weeks.reduce((sum, w) => sum + w.elevationM, 0)
  const kmEffort = weeks.reduce((sum, w) => sum + Number(w.kmEffort), 0)
  const minutes = weeks.reduce((sum, w) => sum + w.durationMin, 0)
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      {t('volume.totalPrefix')}{' '}
      <span className="font-semibold text-ink dark:text-linen">{Math.round(km)} km</span> ·{' '}
      {elevation.toLocaleString(numberLocale())} m D+ · {formatChrono(minutes * 60)} ·{' '}
      <span className="font-semibold text-ink dark:text-linen">{Math.round(kmEffort)} km-effort</span>
    </p>
  )
}

/* ── Checkpoints table ─────────────────────────────────────────────── */

function CheckpointsTable({ checkpoints }: { checkpoints: DurationCheckpoint[] }) {
  const { t } = useTranslation('stats')
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
          <p className={`mt-1 text-[10px] ${muted}`}>{t('volume.runs', { count: cp.samples })}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Efficiency ────────────────────────────────────────────────────── */

function EfficiencyChart({ months }: { months: MonthEfficiency[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  const points = months.filter((m) => m.metersPerBeat != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('efficiency.notEnough')}</p>
  const values = points.map((m) => m.metersPerBeat!)
  const lo = Math.min(...values) * 0.97
  const hi = Math.max(...values) * 1.03
  const x = xScale(points.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = points.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.metersPerBeat!)}`).join(' ')

  const hovered = hover != null ? points[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={x(hover!) / W}
          lines={[
            format(parseISO(`${hovered.month}-01`), 'MMMM yyyy', { locale: dateLocale() }),
            t('efficiency.metersPerBeat', { value: hovered.metersPerBeat }),
            t('efficiency.runsWithHr', { count: hovered.runs }),
          ]}
        />
      )}
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('efficiency.aria')}>
      <GridY ticks={[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]} y={y}
        format={(v) => v.toFixed(2)} />
      <path d={path} fill="none" strokeWidth={2} className="stroke-pine-600 dark:stroke-pine-350" />
      {points.map((m, i) => (
        <g key={m.month}>
          <circle cx={x(i)} cy={y(m.metersPerBeat!)} r={3}
            className="fill-pine-600 dark:fill-pine-350" />
          <text x={x(i)} y={H - 6} textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {format(parseISO(`${m.month}-01`), 'MMM', { locale: dateLocale() })}
          </text>
        </g>
      ))}
      <HitStrips count={points.length} onHover={setHover} />
    </svg>
    </div>
  )
}

/* ── VO2max trend & critical pace ──────────────────────────────────── */

function Vo2maxChart({ months }: { months: Vo2maxPoint[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  const points = months.filter((m) => m.vo2max != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('vo2max.notEnough')}</p>
  const values = points.map((m) => m.vo2max!)
  const lo = Math.min(...values) - 2
  const hi = Math.max(...values) + 2
  const x = xScale(points.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = points.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.vo2max!)}`).join(' ')

  const hovered = hover != null ? points[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={x(hover!) / W}
          lines={[
            format(parseISO(`${hovered.month}-01`), 'MMMM yyyy', { locale: dateLocale() }),
            t('vo2max.value', { value: hovered.vo2max }),
            t('vo2max.runs', { count: hovered.runs }),
          ]}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('vo2max.aria')}>
        <GridY ticks={[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]} y={y} format={(v) => v.toFixed(0)} />
        <path d={path} fill="none" strokeWidth={2} className="stroke-pine-600 dark:stroke-pine-350" />
        {points.map((m, i) => (
          <g key={m.month}>
            <circle cx={x(i)} cy={y(m.vo2max!)} r={3} className="fill-pine-600 dark:fill-pine-350" />
            <text x={x(i)} y={H - 6} textAnchor="middle"
              className="fill-moss-500 text-[10px] dark:fill-moss-400">
              {format(parseISO(`${m.month}-01`), 'MMM', { locale: dateLocale() })}
            </text>
          </g>
        ))}
        <HitStrips count={points.length} onHover={setHover} />
      </svg>
    </div>
  )
}

const statCard =
  'rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900'

function CriticalPaceStat({ cp }: { cp: CriticalPace }) {
  const { t } = useTranslation('stats')
  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className={statCard}>
          <p className={`text-xs ${muted}`}>{t('vo2max.criticalPace')}</p>
          <p className="mt-0.5 text-xl font-semibold">{formatPace(cp.criticalPaceSecPerKm)}</p>
        </div>
        <div className={statCard}>
          <p className={`text-xs ${muted}`}>{t('vo2max.criticalSpeed')}</p>
          <p className="mt-0.5 text-xl font-semibold">{cp.criticalSpeedMps.toFixed(2)}<span className="text-sm font-normal"> m/s</span></p>
        </div>
        <div className={statCard}>
          <p className={`text-xs ${muted}`}>{t('vo2max.anaerobic')}</p>
          <p className="mt-0.5 text-xl font-semibold">{cp.anaerobicCapacityM}<span className="text-sm font-normal"> m</span></p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${muted}`}>
        {t('vo2max.criticalBasis', { count: cp.samples, r2: cp.fitQuality.toFixed(2) })}
      </p>
    </>
  )
}

/* ── Durability: aerobic decoupling on long runs ───────────────────── */

function DurabilityChart({ points }: { points: DurabilityPoint[] }) {
  const { t } = useTranslation('stats')
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('durability.notEnough')}</p>
  const values = points.map((p) => p.decouplingPct)
  const lo = Math.min(...values, 0)
  const hi = Math.max(...values, 6) * 1.05
  const x = xScale(points.length)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.decouplingPct)}`).join(' ')

  const hovered = hover != null ? points[hover] : null
  return (
    <div className="relative" onPointerLeave={() => setHover(null)}>
      {hovered && (
        <ChartTooltip
          xRatio={x(hover!) / W}
          lines={[
            format(parseISO(hovered.date), 'd MMMM yyyy', { locale: dateLocale() }),
            t('durability.decoupling', { value: hovered.decouplingPct.toFixed(1) }),
            `${hovered.distanceKm ?? '—'} km · ${formatChrono(hovered.durationMin * 60)}`,
          ]}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('durability.aria')}>
        <GridY ticks={[0, Math.round(hi / 2)]} y={y} format={(v) => `${v.toFixed(0)}%`} />
        {/* the 5 % durability threshold */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(5)} y2={y(5)} strokeWidth={1} strokeDasharray="4 3"
          className="stroke-gold-600/70 dark:stroke-gold-300/70" />
        <text x={W - PAD.right + 4} y={y(5) + 3} textAnchor="start"
          className="fill-gold-600 text-[10px] dark:fill-gold-300">5%</text>
        <path d={path} fill="none" strokeWidth={2} className="stroke-lake-600 dark:stroke-lake-300" />
        {points.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.decouplingPct)} r={3}
            className={p.decouplingPct > 5
              ? 'fill-clay-500 dark:fill-clay-300'
              : 'fill-pine-600 dark:fill-pine-350'} />
        ))}
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {format(parseISO(points[i].date), 'd MMM', { locale: dateLocale() })}
          </text>
        ))}
        <HitStrips count={points.length} onHover={setHover} />
      </svg>
    </div>
  )
}

/* ── Predictions ───────────────────────────────────────────────────── */

function TrailEstimates({ estimates }: { estimates: TrailEstimate[] }) {
  const { t } = useTranslation('stats')
  return (
    <div className="mt-3 space-y-2">
      {estimates.map((estimate) => (
        <div key={`${estimate.objectiveName}-${estimate.date}`}
          className="rounded-lg border border-copper-600/30 bg-copper-600/5 p-3 dark:border-copper-300/30 dark:bg-copper-300/10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {estimate.objectiveName}
              <span className={`ml-2 text-xs ${muted}`}>
                {format(parseISO(estimate.date), 'd MMM yyyy', { locale: dateLocale() })} ·{' '}
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
            {t('predictions.trailBasis', { count: estimate.sampleRuns })}
          </p>
        </div>
      ))}
    </div>
  )
}

function RoadPredictions({ predictions }: { predictions: RoadPrediction[] }) {
  const { t } = useTranslation('stats')
  return (
    <div className="mt-4 overflow-x-auto">
      <p className={`mb-1 text-xs ${muted}`}>
        {t('predictions.roadHint')}
      </p>
      <table className="w-full min-w-105 text-sm">
        <thead>
          <tr className={`text-left text-xs uppercase ${muted}`}>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colDistance')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colRange')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colRecord')}</th>
            <th className="py-1.5 font-semibold">{t('predictions.colBase')}</th>
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
