import { addDays, endOfMonth, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  ChartSurface,
  GridY,
  Legend,
  ThresholdLine,
  TooltipLines,
  XLabels,
  bandX,
  gappedLinePath,
  labelStep,
  linearY,
  pointX,
} from '../../components/chartkit'
import { dateLocale, numberLocale } from '../../i18n'
import { muted } from '../../lib/ui'
import type {
  CriticalPace,
  DayForm,
  DurabilityPoint,
  DurationCheckpoint,
  MonthEfficiency,
  Vo2maxPoint,
  WeekEffort,
  WeekMonotony,
  WeekVolume,
  WeekZones,
} from '../athlete/api'
import { formatChrono, formatPace } from './format'

/** Bucket click-through to the activities feed: (fromISO, toISO). */
export type OpenRange = (from: string, to: string) => void

const weekEnd = (weekStart: string) => format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd')
const monthStart = (month: string) => `${month}-01`
const monthEnd = (month: string) => format(endOfMonth(parseISO(`${month}-01`)), 'yyyy-MM-dd')

/* ── Forme & Fitness: three series in one frame ────────────────────── */

export function FormChart({ days, onOpenRange }: { days: DayForm[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  if (days.length < 2) return <p className={`text-sm ${muted}`}>{t('form.notEnough')}</p>
  const values = days.flatMap((d) => [d.fitness, d.fatigue, d.formScore])
  const lo = Math.min(...values, 0)
  const hi = (Math.max(...values) || 1) * 1.1
  const last = days.at(-1)!

  return (
    <div className="space-y-1">
      <ChartSurface
        ariaLabel={t('form.aria')}
        count={days.length}
        crosshair
        xFor={(i, frame) => pointX(frame, days.length)(i)}
        onSelect={onOpenRange && ((i) => onOpenRange(days[i].date, days[i].date))}
        tooltip={(i) => (
          <TooltipLines
            lines={[
              format(parseISO(days[i].date), 'EEEE d MMMM', { locale: dateLocale() }),
              `${t('form.fitness')} ${days[i].fitness}`,
              `${t('form.fatigue')} ${days[i].fatigue}`,
              `${t('form.form')} ${days[i].formScore}`,
              onOpenRange ? t('drill') : null,
            ]}
          />
        )}
      >
        {(frame) => {
          const x = pointX(frame, days.length)
          const y = linearY(frame, lo, hi)
          const path = (value: (d: DayForm) => number) =>
            days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(value(d))}`).join(' ')
          return (
            <>
              <GridY frame={frame} ticks={[0, Math.round(hi * 0.5)]} y={y} />
              <path
                d={`${path((d) => d.formScore)} L ${x(days.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
                className="fill-pine-600/10 dark:fill-pine-350/10"
              />
              <path d={path((d) => d.fitness)} fill="none" strokeWidth={2} className="stroke-pine-600 dark:stroke-pine-350" />
              <path d={path((d) => d.fatigue)} fill="none" strokeWidth={1.5} strokeDasharray="4 3" className="stroke-clay-500 dark:stroke-clay-300" />
              <path d={path((d) => d.formScore)} fill="none" strokeWidth={1.5} className="stroke-lake-600 dark:stroke-lake-300" />
              <XLabels
                frame={frame}
                count={days.length}
                x={x}
                step={Math.max(1, Math.floor(days.length / 2))}
                label={(i) => format(parseISO(days[i].date), 'd MMM', { locale: dateLocale() })}
              />
            </>
          )
        }}
      </ChartSurface>
      <Legend
        items={[
          { swatch: 'bg-pine-600 dark:bg-pine-350', label: t('form.fitness'), value: last.fitness },
          { swatch: 'bg-clay-500 dark:bg-clay-300', label: t('form.fatigue'), value: last.fatigue },
          { swatch: 'bg-lake-600 dark:bg-lake-300', label: t('form.form'), value: last.formScore },
        ]}
      />
    </div>
  )
}

/* ── Weekly effort with the target band ────────────────────────────── */

export function EffortBandChart({ weeks, onOpenRange }: { weeks: WeekEffort[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>{t('effort.noData')}</p>
  const hi = Math.max(...weeks.flatMap((w) => [w.effort, w.bandHigh ?? 0]), 1) * 1.1

  return (
    <ChartSurface
      ariaLabel={t('effort.aria')}
      count={weeks.length}
      onSelect={onOpenRange && ((i) => onOpenRange(weeks[i].weekStart, weekEnd(weeks[i].weekStart)))}
      tooltip={(i) => {
        const week = weeks[i]
        return (
          <TooltipLines
            lines={[
              t('effort.weekOf', { date: format(parseISO(week.weekStart), 'd MMMM', { locale: dateLocale() }) }),
              t('effort.relativeEffort', { value: week.effort }),
              week.bandLow != null
                ? t('effort.targetZone', { low: week.bandLow, high: week.bandHigh })
                : t('effort.targetZoneNone'),
              week.partlyEstimated ? t('effort.estimatedNote') : null,
              onOpenRange ? t('drill') : null,
            ]}
          />
        )
      }}
    >
      {(frame) => {
        const y = linearY(frame, 0, hi)
        const { band, left } = bandX(frame, weeks.length)
        const step = labelStep(band)
        return (
          <>
            <GridY frame={frame} ticks={[Math.round(hi * 0.3), Math.round(hi * 0.7)]} y={y} />
            {weeks.map((week, i) =>
              week.bandLow != null && week.bandHigh != null ? (
                <rect
                  key={`band-${week.weekStart}`}
                  x={left(i)}
                  width={band}
                  y={y(week.bandHigh)}
                  height={Math.max(1, y(week.bandLow) - y(week.bandHigh))}
                  className="fill-pine-600/15 dark:fill-pine-350/15"
                />
              ) : null,
            )}
            {weeks.map((week, i) => {
              const inBand =
                week.bandLow != null && week.bandHigh != null && week.effort >= week.bandLow && week.effort <= week.bandHigh
              const over = week.bandHigh != null && week.effort > week.bandHigh
              return (
                <rect
                  key={week.weekStart}
                  x={left(i) + band * 0.22}
                  width={band * 0.56}
                  y={y(week.effort)}
                  height={Math.max(1, y(0) - y(week.effort))}
                  rx={2}
                  className={
                    over
                      ? 'fill-clay-500 dark:fill-clay-300'
                      : inBand
                        ? 'fill-pine-600 dark:fill-pine-350'
                        : 'fill-moss-400 dark:fill-moss-500'
                  }
                />
              )
            })}
            <XLabels
              frame={frame}
              count={weeks.length}
              x={(i) => left(i) + band / 2}
              step={step}
              label={(i) => format(parseISO(weeks[i].weekStart), 'd MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

export function EffortStatus({ weeks }: { weeks: WeekEffort[] }) {
  const { t } = useTranslation('stats')
  const current = weeks.at(-1)
  if (!current || current.bandLow == null || current.bandHigh == null) return null
  const status =
    current.effort > current.bandHigh
      ? t('effort.statusOver')
      : current.effort >= current.bandLow
        ? t('effort.statusIn')
        : t('effort.statusUnder', { low: current.bandLow, high: current.bandHigh })
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      {t('effort.thisWeek')} <span className="font-semibold text-ink dark:text-linen">{current.effort}</span> · {status}
      {current.partlyEstimated && ` · ${t('effort.estimatedNote')}`}
    </p>
  )
}

/* ── Monotony (Foster) ─────────────────────────────────────────────── */

export function MonotonyChart({ weeks, onOpenRange }: { weeks: WeekMonotony[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  const points = weeks.filter((w) => w.monotony != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('monotony.notEnough')}</p>
  const maxM = Math.max(...points.map((w) => w.monotony!), 2.2) * 1.05

  return (
    <ChartSurface
      ariaLabel={t('monotony.aria')}
      count={weeks.length}
      pad={{ right: 34 }}
      xFor={(i, frame) => pointX(frame, weeks.length)(i)}
      onSelect={onOpenRange && ((i) => onOpenRange(weeks[i].weekStart, weekEnd(weeks[i].weekStart)))}
      tooltip={(i) => {
        const week = weeks[i]
        if (week.monotony == null) return null
        return (
          <TooltipLines
            lines={[
              t('effort.weekOf', { date: format(parseISO(week.weekStart), 'd MMMM', { locale: dateLocale() }) }),
              t('monotony.value', { value: week.monotony.toFixed(2) }),
              t('monotony.strain', { value: week.strain ?? 0 }),
              week.flagged ? t('monotony.flagged') : null,
              onOpenRange ? t('drill') : null,
            ]}
          />
        )
      }}
    >
      {(frame) => {
        const x = pointX(frame, weeks.length)
        const y = linearY(frame, 0, maxM)
        const step = labelStep(frame.plotW / Math.max(1, weeks.length))
        return (
          <>
            <GridY frame={frame} ticks={[maxM * 0.5]} y={y} format={(v) => v.toFixed(1)} />
            <ThresholdLine
              frame={frame}
              y={y(2)}
              label="2.0"
              className="stroke-clay-500/70 dark:stroke-clay-300/70"
              labelClassName="fill-clay-500 dark:fill-clay-300"
            />
            <path
              d={gappedLinePath(x, y, weeks.map((w) => w.monotony))}
              fill="none"
              strokeWidth={2}
              className="stroke-pine-600 dark:stroke-pine-350"
            />
            {weeks.map((week, i) =>
              week.monotony == null ? null : (
                <circle
                  key={week.weekStart}
                  cx={x(i)}
                  cy={y(week.monotony)}
                  r={week.flagged ? 3.5 : 2.5}
                  className={week.flagged ? 'fill-clay-500 dark:fill-clay-300' : 'fill-pine-600 dark:fill-pine-350'}
                />
              ),
            )}
            <XLabels
              frame={frame}
              count={weeks.length}
              x={x}
              step={step}
              label={(i) => format(parseISO(weeks[i].weekStart), 'd MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

/* ── Volume: km bars + D+ line, two axes ───────────────────────────── */

export function VolumeChart({ weeks, onOpenRange }: { weeks: WeekVolume[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  if (weeks.length === 0) return <p className={`text-sm ${muted}`}>{t('effort.noData')}</p>
  const maxKm = Math.max(...weeks.map((w) => Number(w.distanceKm)), 1)
  const maxD = Math.max(...weeks.map((w) => w.elevationM), 1)

  return (
    <ChartSurface
      ariaLabel={t('volume.aria')}
      count={weeks.length}
      pad={{ right: 44 }}
      onSelect={onOpenRange && ((i) => onOpenRange(weeks[i].weekStart, weekEnd(weeks[i].weekStart)))}
      tooltip={(i) => {
        const week = weeks[i]
        return (
          <TooltipLines
            lines={[
              t('effort.weekOf', { date: format(parseISO(week.weekStart), 'd MMMM', { locale: dateLocale() }) }),
              t('volume.kmAndElevation', { km: week.distanceKm, elevation: week.elevationM }),
              `${t('volume.kmEffort', { value: week.kmEffort })} · ${t('volume.runs', { count: week.runs })}`,
              formatChrono(week.durationMin * 60),
              onOpenRange ? t('drill') : null,
            ]}
          />
        )
      }}
    >
      {(frame) => {
        const yKm = linearY(frame, 0, maxKm * 1.1)
        const yD = linearY(frame, 0, maxD * 1.15)
        const { band, left, center } = bandX(frame, weeks.length)
        const step = labelStep(band)
        const linePath = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'} ${center(i)} ${yD(w.elevationM)}`).join(' ')
        return (
          <>
            <GridY frame={frame} ticks={[maxKm * 0.5, maxKm]} y={yKm} format={(v) => `${Math.round(v)}k`} />
            <text
              x={frame.width - frame.pad.right + 6}
              y={yD(maxD) + 3}
              textAnchor="start"
              className="fill-lake-600 text-[10px] dark:fill-lake-300"
            >
              {Math.round(maxD)}m
            </text>
            {weeks.map((week, i) => (
              <rect
                key={week.weekStart}
                x={left(i) + band * 0.2}
                width={band * 0.6}
                y={yKm(Number(week.distanceKm))}
                height={Math.max(1, yKm(0) - yKm(Number(week.distanceKm)))}
                rx={2}
                className="fill-pine-600 dark:fill-pine-350"
              />
            ))}
            <path d={linePath} fill="none" strokeWidth={2} className="stroke-lake-600 dark:stroke-lake-300" />
            <XLabels
              frame={frame}
              count={weeks.length}
              x={center}
              step={step}
              label={(i) => format(parseISO(weeks[i].weekStart), 'd MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

export function VolumeTotals({ weeks }: { weeks: WeekVolume[] }) {
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

const statCard = 'rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900'

export function CheckpointsTable({ checkpoints }: { checkpoints: DurationCheckpoint[] }) {
  const { t } = useTranslation('stats')
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {checkpoints.map((cp) => (
        <div key={cp.minutes} className={statCard}>
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

export function EfficiencyChart({
  months,
  onOpenRange,
}: {
  months: MonthEfficiency[]
  onOpenRange?: OpenRange
}) {
  const { t } = useTranslation('stats')
  const points = months.filter((m) => m.metersPerBeat != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('efficiency.notEnough')}</p>
  const values = points.map((m) => m.metersPerBeat!)
  const lo = Math.min(...values) * 0.97
  const hi = Math.max(...values) * 1.03

  return (
    <ChartSurface
      ariaLabel={t('efficiency.aria')}
      count={points.length}
      xFor={(i, frame) => pointX(frame, points.length)(i)}
      onSelect={onOpenRange && ((i) => onOpenRange(monthStart(points[i].month), monthEnd(points[i].month)))}
      tooltip={(i) => (
        <TooltipLines
          lines={[
            format(parseISO(`${points[i].month}-01`), 'MMMM yyyy', { locale: dateLocale() }),
            t('efficiency.metersPerBeat', { value: points[i].metersPerBeat }),
            t('efficiency.runsWithHr', { count: points[i].runs }),
            onOpenRange ? t('drill') : null,
          ]}
        />
      )}
    >
      {(frame) => {
        const x = pointX(frame, points.length)
        const y = linearY(frame, lo, hi)
        return (
          <>
            <GridY frame={frame} ticks={[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]} y={y} format={(v) => v.toFixed(2)} />
            <path
              d={points.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.metersPerBeat!)}`).join(' ')}
              fill="none"
              strokeWidth={2}
              className="stroke-pine-600 dark:stroke-pine-350"
            />
            {points.map((m, i) => (
              <circle key={m.month} cx={x(i)} cy={y(m.metersPerBeat!)} r={3} className="fill-pine-600 dark:fill-pine-350" />
            ))}
            <XLabels
              frame={frame}
              count={points.length}
              x={x}
              label={(i) => format(parseISO(`${points[i].month}-01`), 'MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

/* ── VO2max trend & critical pace ──────────────────────────────────── */

export function Vo2maxChart({ months, onOpenRange }: { months: Vo2maxPoint[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  const points = months.filter((m) => m.vo2max != null)
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('vo2max.notEnough')}</p>
  const values = points.map((m) => m.vo2max!)
  const lo = Math.min(...values) - 2
  const hi = Math.max(...values) + 2

  return (
    <ChartSurface
      ariaLabel={t('vo2max.aria')}
      count={points.length}
      xFor={(i, frame) => pointX(frame, points.length)(i)}
      onSelect={onOpenRange && ((i) => onOpenRange(monthStart(points[i].month), monthEnd(points[i].month)))}
      tooltip={(i) => (
        <TooltipLines
          lines={[
            format(parseISO(`${points[i].month}-01`), 'MMMM yyyy', { locale: dateLocale() }),
            t('vo2max.value', { value: points[i].vo2max }),
            t('vo2max.runs', { count: points[i].runs }),
            onOpenRange ? t('drill') : null,
          ]}
        />
      )}
    >
      {(frame) => {
        const x = pointX(frame, points.length)
        const y = linearY(frame, lo, hi)
        return (
          <>
            <GridY frame={frame} ticks={[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]} y={y} format={(v) => v.toFixed(0)} />
            <path
              d={points.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.vo2max!)}`).join(' ')}
              fill="none"
              strokeWidth={2}
              className="stroke-pine-600 dark:stroke-pine-350"
            />
            {points.map((m, i) => (
              <circle key={m.month} cx={x(i)} cy={y(m.vo2max!)} r={3} className="fill-pine-600 dark:fill-pine-350" />
            ))}
            <XLabels
              frame={frame}
              count={points.length}
              x={x}
              label={(i) => format(parseISO(`${points[i].month}-01`), 'MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

export function CriticalPaceStat({ cp }: { cp: CriticalPace }) {
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
          <p className="mt-0.5 text-xl font-semibold">
            {cp.criticalSpeedMps.toFixed(2)}
            <span className="text-sm font-normal"> m/s</span>
          </p>
        </div>
        <div className={statCard}>
          <p className={`text-xs ${muted}`}>{t('vo2max.anaerobic')}</p>
          <p className="mt-0.5 text-xl font-semibold">
            {cp.anaerobicCapacityM}
            <span className="text-sm font-normal"> m</span>
          </p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${muted}`}>{t('vo2max.criticalBasis', { count: cp.samples, r2: cp.fitQuality.toFixed(2) })}</p>
    </>
  )
}

/* ── Durability: aerobic decoupling on long runs ───────────────────── */

export function DurabilityChart({
  points,
  onOpenRange,
}: {
  points: DurabilityPoint[]
  onOpenRange?: OpenRange
}) {
  const { t } = useTranslation('stats')
  if (points.length < 2) return <p className={`text-sm ${muted}`}>{t('durability.notEnough')}</p>
  const values = points.map((p) => p.decouplingPct)
  const lo = Math.min(...values, 0)
  const hi = Math.max(...values, 6) * 1.05

  return (
    <ChartSurface
      ariaLabel={t('durability.aria')}
      count={points.length}
      pad={{ right: 34 }}
      xFor={(i, frame) => pointX(frame, points.length)(i)}
      onSelect={onOpenRange && ((i) => onOpenRange(points[i].date, points[i].date))}
      tooltip={(i) => (
        <TooltipLines
          lines={[
            format(parseISO(points[i].date), 'd MMMM yyyy', { locale: dateLocale() }),
            t('durability.decoupling', { value: points[i].decouplingPct.toFixed(1) }),
            `${points[i].distanceKm ?? '—'} km · ${formatChrono(points[i].durationMin * 60)}`,
            onOpenRange ? t('drill') : null,
          ]}
        />
      )}
    >
      {(frame) => {
        const x = pointX(frame, points.length)
        const y = linearY(frame, lo, hi)
        return (
          <>
            <GridY frame={frame} ticks={[0, Math.round(hi / 2)]} y={y} format={(v) => `${v.toFixed(0)}%`} />
            <ThresholdLine
              frame={frame}
              y={y(5)}
              label="5%"
              className="stroke-gold-600/70 dark:stroke-gold-300/70"
              labelClassName="fill-gold-600 dark:fill-gold-300"
            />
            <path
              d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.decouplingPct)}`).join(' ')}
              fill="none"
              strokeWidth={2}
              className="stroke-lake-600 dark:stroke-lake-300"
            />
            {points.map((p, i) => (
              <circle
                key={`${p.date}-${i}`}
                cx={x(i)}
                cy={y(p.decouplingPct)}
                r={3}
                className={p.decouplingPct > 5 ? 'fill-clay-500 dark:fill-clay-300' : 'fill-pine-600 dark:fill-pine-350'}
              />
            ))}
            <XLabels
              frame={frame}
              count={points.length}
              x={x}
              step={Math.max(1, Math.floor(points.length / 2))}
              label={(i) => format(parseISO(points[i].date), 'd MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

/* ── Weekly time in HR zones ───────────────────────────────────────── */

export const ZONE_FILL = [
  'fill-moss-400 dark:fill-moss-500',
  'fill-pine-600 dark:fill-pine-350',
  'fill-gold-600 dark:fill-gold-300',
  'fill-copper-600 dark:fill-copper-300',
  'fill-clay-500 dark:fill-clay-300',
]

function formatZoneHours(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Weekly stacked Z1–Z5 bars — the polarization check, week by week. */
export function ZoneWeeklyChart({ weeks, onOpenRange }: { weeks: WeekZones[]; onOpenRange?: OpenRange }) {
  const { t } = useTranslation('stats')
  const withData = weeks.filter((w) => w.seconds.some((s) => s > 0))
  if (withData.length === 0) return <p className={`text-sm ${muted}`}>{t('zones.noData')}</p>
  const maxTotal = Math.max(...weeks.map((w) => w.seconds.reduce((a, b) => a + b, 0)), 1)

  return (
    <ChartSurface
      ariaLabel={t('zones.aria')}
      count={weeks.length}
      onSelect={onOpenRange && ((i) => onOpenRange(weeks[i].weekStart, weekEnd(weeks[i].weekStart)))}
      tooltip={(i) => {
        const week = weeks[i]
        const total = week.seconds.reduce((a, b) => a + b, 0)
        if (total === 0) return null
        return (
          <TooltipLines
            lines={[
              t('effort.weekOf', { date: format(parseISO(week.weekStart), 'd MMMM', { locale: dateLocale() }) }),
              ...week.seconds
                .map((sec, z) => (sec > 0 ? `Z${z + 1} · ${formatZoneHours(sec)} · ${Math.round((sec / total) * 100)}%` : null))
                .filter((line): line is string => line != null)
                .reverse(),
              week.partlyEstimated ? t('zones.estimatedNote') : null,
              onOpenRange ? t('drill') : null,
            ]}
          />
        )
      }}
    >
      {(frame) => {
        const y = linearY(frame, 0, maxTotal * 1.05)
        const { band, left, center } = bandX(frame, weeks.length)
        const step = labelStep(band)
        return (
          <>
            <GridY
              frame={frame}
              ticks={[maxTotal * 0.5, maxTotal]}
              y={y}
              format={(v) => formatZoneHours(v)}
            />
            {weeks.map((week, i) => {
              let cursor = 0
              return week.seconds.map((sec, z) => {
                if (sec <= 0) return null
                const y1 = y(cursor + sec)
                const height = y(cursor) - y1
                cursor += sec
                return (
                  <rect
                    key={`${week.weekStart}-${z}`}
                    x={left(i) + band * 0.2}
                    width={band * 0.6}
                    y={y1}
                    height={Math.max(1, height)}
                    className={ZONE_FILL[z]}
                  />
                )
              })
            })}
            <XLabels
              frame={frame}
              count={weeks.length}
              x={center}
              step={step}
              label={(i) => format(parseISO(weeks[i].weekStart), 'd MMM', { locale: dateLocale() })}
            />
          </>
        )
      }}
    </ChartSurface>
  )
}

/** "82 % easy / 18 % hard" over the visible period — Z1+Z2 vs Z3–Z5. */
export function PolarizationNote({ weeks }: { weeks: WeekZones[] }) {
  const { t } = useTranslation('stats')
  const totals = [0, 0, 0, 0, 0]
  for (const week of weeks) week.seconds.forEach((sec, z) => (totals[z] += sec))
  const total = totals.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const easy = Math.round(((totals[0] + totals[1]) / total) * 100)
  const estimated = weeks.some((w) => w.partlyEstimated)
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      {t('zones.polarization')}{' '}
      <span className="font-semibold text-ink dark:text-linen">{easy} %</span> {t('zones.easyShare')}{' '}
      · <span className="font-semibold text-ink dark:text-linen">{100 - easy} %</span>{' '}
      {t('zones.hardShare')} · {t('zones.target8020')}
      {estimated && ` · ${t('zones.estimatedNote')}`}
    </p>
  )
}
