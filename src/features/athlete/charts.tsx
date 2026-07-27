import { useTranslation } from 'react-i18next'
import {
  ChartSurface,
  GridY,
  TooltipLines,
  XLabels,
  labelStep,
  linearY,
  pointX,
} from '../../components/chartkit'
import { muted } from '../../lib/ui'

/*
 * Trend charts on the shared chart kit (today: the stats EvolutionCard).
 * Single series per chart (the title names it — no legend), hairline grids,
 * hover tooltips.
 */

const H = 190

/** One x-axis bucket of the volume/trend charts — a month or an ISO week. */
export interface PeriodPoint {
  key: string
  /** Axis tick + tooltip header, already localized ("juil. 26", "6 juil."). */
  label: string
  runs: number
  distanceKm: number
  durationMin: number
  elevationM: number
  avgPaceSecPerKm: number | null
  avgHr: number | null
  avgCadenceSpm: number | null
  relativeEffort: number
}

/* ── Trend line per period (pace / HR / cadence) ───────────────────── */

interface TrendLineProps {
  periods: PeriodPoint[]
  value: (p: PeriodPoint) => number | null
  formatValue: (v: number) => string
  /** Compact tick label for the y-axis (falls back to formatValue). */
  formatTick?: (v: number) => string
  /** Pace reads better inverted: up = faster. */
  invert?: boolean
  label: string
  /** Bucket click-through (drill-down) — receives the clicked period. */
  onSelect?: (p: PeriodPoint) => void
}

export function TrendLine({
  periods,
  value,
  formatValue,
  formatTick,
  invert,
  label,
  onSelect,
}: TrendLineProps) {
  const { t } = useTranslation('athlete')
  const points = periods
    .map((p, i) => ({ i, v: value(p) }))
    .filter((p): p is { i: number; v: number } => p.v != null)

  if (points.length === 0) {
    return <p className={`py-10 text-center text-sm ${muted}`}>{t('charts.noData')}</p>
  }

  const values = points.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const byIndex = new Map(points.map((p) => [p.i, p.v]))
  const last = points[points.length - 1]

  return (
    <ChartSurface
      height={H}
      ariaLabel={label}
      count={periods.length}
      xFor={(i, frame) => pointX(frame, periods.length)(i)}
      crosshair
      onSelect={onSelect && ((i) => onSelect(periods[i]))}
      tooltip={(i) => {
        const v = byIndex.get(i)
        if (v == null) return null
        return (
          <TooltipLines
            lines={[periods[i].label, `${label} : ${formatValue(v)}`, onSelect ? t('charts.drill') : null]}
          />
        )
      }}
    >
      {(frame, hover) => {
        const x = pointX(frame, periods.length)
        const y = linearY(frame, lo, hi, invert)
        const step = labelStep(frame.plotW / Math.max(1, periods.length))

        // gap on missing periods: restart the path after a hole
        let path = ''
        let previous = -2
        for (const p of points) {
          path += `${p.i === previous + 1 ? ' L' : ' M'} ${x(p.i)} ${y(p.v)}`
          previous = p.i
        }
        const gridTicks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.8]
        const hoveredValue = hover != null ? byIndex.get(hover) : undefined

        return (
          <>
            <GridY
              frame={frame}
              ticks={gridTicks}
              y={y}
              format={(v) => (formatTick ?? formatValue)(Math.round(v))}
            />
            <path
              d={path}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-pine-600 dark:stroke-pine-350"
            />
            <circle
              cx={x(last.i)}
              cy={y(last.v)}
              r={4}
              strokeWidth={2}
              className="fill-pine-600 stroke-moss-25 dark:fill-pine-350 dark:stroke-moss-850"
            />
            {hover != null && hoveredValue != null && (
              <circle
                cx={x(hover)}
                cy={y(hoveredValue)}
                r={4}
                strokeWidth={2}
                className="fill-pine-600 stroke-moss-25 dark:fill-pine-350 dark:stroke-moss-850"
              />
            )}
            <XLabels frame={frame} count={periods.length} x={x} step={step} label={(i) => periods[i].label} />
          </>
        )
      }}
    </ChartSurface>
  )
}
