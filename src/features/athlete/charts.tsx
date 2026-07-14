import { useState } from 'react'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMeasuredWidth } from '../../lib/useMeasuredWidth'
import type { MonthlyStat, WeeklyEffort } from './api'
import { formatMonth } from './labels'

/*
 * Hub trend charts, hand-rolled SVG on Massif tokens. Single series per
 * chart (the title names it — no legend), hairline grids, hover tooltips.
 * The viewBox width is measured from the container (1:1 with CSS pixels)
 * so tick text stays readable on narrow screens.
 */

const FALLBACK_W = 720
const H = 190
const PAD = { top: 14, right: 12, bottom: 24, left: 44 }
const PLOT_H = H - PAD.top - PAD.bottom

/** Label every Nth point so x-axis labels keep ~their designed footprint. */
function labelStep(band: number, minPx: number): number {
  return Math.max(1, Math.ceil(minPx / band))
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 3 >= max) ?? raw
  return [0, 1, 2, 3].map((i) => Math.round(i * step))
}

function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height)
  const bottom = y + height
  return `M ${x} ${bottom} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${bottom} Z`
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const leftHalf = x < width / 2
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-xs shadow-sm dark:border-moss-750 dark:bg-moss-850"
      style={leftHalf ? { left: `${((x + 14) / width) * 100}%` } : { right: `${(1 - (x - 14) / width) * 100}%` }}
    >
      {children}
    </div>
  )
}

function Grid({
  ticks,
  y,
  width,
  format: fmt,
}: {
  ticks: number[]
  y: (v: number) => number
  width: number
  format?: (v: number) => string
}) {
  return (
    <>
      {[...new Set(ticks)].map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(t)}
            y2={y(t)}
            className="stroke-moss-200 dark:stroke-moss-750"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-moss-500 text-[10px] dark:fill-moss-400"
          >
            {fmt ? fmt(t) : t.toLocaleString('fr-FR')}
          </text>
        </g>
      ))}
    </>
  )
}

/* ── Monthly bars (volume / D+) ────────────────────────────────────── */

interface MonthlyBarsProps {
  months: MonthlyStat[]
  value: (m: MonthlyStat) => number
  unit: string
}

export function MonthlyBars({ months, value, unit }: MonthlyBarsProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const plotW = width - PAD.left - PAD.right
  const max = Math.max(...months.map(value), 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H
  const band = plotW / months.length
  const barWidth = Math.min(24, band * 0.6)
  const step = labelStep(band, 52)

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label={`Par mois (${unit})`}>
        <Grid ticks={ticks} y={y} width={width} />
        {months.map((month, i) => {
          const v = value(month)
          return (
            <g key={month.month}>
              {v > 0 && (
                <path
                  d={roundedTopBar(PAD.left + i * band + (band - barWidth) / 2, y(v), barWidth, y(0) - y(v))}
                  className="fill-pine-600 dark:fill-pine-350"
                  opacity={hover === i ? 1 : 0.9}
                />
              )}
              {i % step === 0 && (
                <text
                  x={PAD.left + i * band + band / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-moss-500 text-[10px] dark:fill-moss-400"
                >
                  {formatMonth(month.month)}
                </text>
              )}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <Tooltip x={PAD.left + hover * band + band / 2} width={width}>
          <p className="font-semibold">{formatMonth(months[hover].month)}</p>
          <dl className="mt-1 space-y-0.5">
            <div className="flex justify-between">
              <dt className="text-moss-500 dark:text-moss-400">{unit}</dt>
              <dd className="font-medium">{value(months[hover]).toLocaleString('fr-FR')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-moss-500 dark:text-moss-400">Sorties</dt>
              <dd>{months[hover].runs}</dd>
            </div>
          </dl>
        </Tooltip>
      )}
    </div>
  )
}

/* ── Monthly trend line (pace / HR / cadence) ──────────────────────── */

interface TrendLineProps {
  months: MonthlyStat[]
  value: (m: MonthlyStat) => number | null
  formatValue: (v: number) => string
  /** Compact tick label for the y-axis (falls back to formatValue). */
  formatTick?: (v: number) => string
  /** Pace reads better inverted: up = faster. */
  invert?: boolean
  label: string
}

export function TrendLine({ months, value, formatValue, formatTick, invert, label }: TrendLineProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const plotW = width - PAD.left - PAD.right
  const points = months.map((m, i) => ({ i, v: value(m) })).filter((p) => p.v != null) as {
    i: number
    v: number
  }[]

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-moss-500 dark:text-moss-400">Pas encore de données.</p>
  }

  const values = points.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo)
    return PAD.top + (invert ? t : 1 - t) * PLOT_H
  }
  const x = (i: number) => PAD.left + (months.length === 1 ? plotW / 2 : (i / (months.length - 1)) * plotW)
  const step = labelStep(plotW / months.length, 52)

  // gap on missing months: restart the path after a hole
  let path = ''
  let previous = -2
  for (const p of points) {
    path += `${p.i === previous + 1 ? ' L' : ' M'} ${x(p.i)} ${y(p.v)}`
    previous = p.i
  }
  const last = points[points.length - 1]
  const hovered = hover != null ? points.find((p) => p.i === hover) : undefined

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {[...new Set([lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.8])].map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-moss-200 dark:stroke-moss-750"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-moss-500 text-[10px] dark:fill-moss-400"
            >
              {(formatTick ?? formatValue)(Math.round(t))}
            </text>
          </g>
        ))}
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
        {hovered && (
          <>
            <line
              x1={x(hovered.i)}
              x2={x(hovered.i)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              className="stroke-moss-300 dark:stroke-moss-700"
              strokeWidth={1}
            />
            <circle
              cx={x(hovered.i)}
              cy={y(hovered.v)}
              r={4}
              strokeWidth={2}
              className="fill-pine-600 stroke-moss-25 dark:fill-pine-350 dark:stroke-moss-850"
            />
          </>
        )}
        {months.map((month, i) => (
          <g key={month.month}>
            {i % step === 0 && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-moss-500 text-[10px] dark:fill-moss-400"
              >
                {formatMonth(month.month)}
              </text>
            )}
            <rect
              x={x(i) - plotW / months.length / 2}
              y={PAD.top}
              width={plotW / months.length}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hover != null && hovered && (
        <Tooltip x={x(hovered.i)} width={width}>
          <p className="font-semibold">{formatMonth(months[hover].month)}</p>
          <p className="mt-1 flex justify-between">
            <span className="text-moss-500 dark:text-moss-400">{label}</span>
            <span className="font-medium">{formatValue(hovered.v)}</span>
          </p>
        </Tooltip>
      )}
    </div>
  )
}

/* ── Weekly relative effort: bars + 4-week rolling average ─────────── */

export function EffortChart({ weeks }: { weeks: WeeklyEffort[] }) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const plotW = width - PAD.left - PAD.right
  const max = Math.max(...weeks.map((w) => w.relativeEffort), 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H
  const band = plotW / weeks.length
  const barWidth = Math.min(24, band * 0.6)
  const step = labelStep(band, 48)

  // trailing 4-week mean — the classic training-load trend line
  const rolling = weeks.map((_, i) => {
    const window = weeks.slice(Math.max(0, i - 3), i + 1)
    return window.reduce((sum, w) => sum + w.relativeEffort, 0) / window.length
  })
  const rollingPath = rolling
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${PAD.left + i * band + band / 2} ${y(v)}`)
    .join(' ')

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-moss-500 dark:text-moss-400">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-pine-600 dark:bg-pine-350" aria-hidden />
          Effort hebdo
        </span>
        <span className="flex items-center gap-1.5 text-xs text-moss-500 dark:text-moss-400">
          <span className="h-[2px] w-4 rounded bg-moss-400 dark:bg-moss-500" aria-hidden />
          Moyenne 4 sem.
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label="Effort relatif hebdomadaire">
        <Grid ticks={ticks} y={y} width={width} />
        {weeks.map((week, i) => (
          <g key={week.weekStart}>
            {week.relativeEffort > 0 && (
              <path
                d={roundedTopBar(
                  PAD.left + i * band + (band - barWidth) / 2,
                  y(week.relativeEffort),
                  barWidth,
                  y(0) - y(week.relativeEffort),
                )}
                className="fill-pine-600 dark:fill-pine-350"
                opacity={hover === i ? 1 : 0.9}
              />
            )}
            {i % step === 0 && (
              <text
                x={PAD.left + i * band + band / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-moss-500 text-[10px] dark:fill-moss-400"
              >
                {format(parseISO(week.weekStart), 'd MMM', { locale: fr })}
              </text>
            )}
            <rect
              x={PAD.left + i * band}
              y={PAD.top}
              width={band}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        <path
          d={rollingPath}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-moss-400 dark:stroke-moss-500"
        />
      </svg>
      {hover != null && (
        <Tooltip x={PAD.left + hover * band + band / 2} width={width}>
          <p className="font-semibold">
            Semaine du {format(parseISO(weeks[hover].weekStart), 'd MMMM', { locale: fr })}
          </p>
          <dl className="mt-1 space-y-0.5">
            <div className="flex justify-between">
              <dt className="text-moss-500 dark:text-moss-400">Effort relatif</dt>
              <dd className="font-medium">{weeks[hover].relativeEffort}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-moss-500 dark:text-moss-400">Volume</dt>
              <dd>{Math.round(weeks[hover].distanceKm)} km</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-moss-500 dark:text-moss-400">Moy. 4 sem.</dt>
              <dd>{Math.round(rolling[hover])}</dd>
            </div>
          </dl>
        </Tooltip>
      )}
    </div>
  )
}
