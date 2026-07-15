import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { dateLocale, numberLocale } from '../../i18n'
import { useMeasuredWidth } from '../../lib/useMeasuredWidth'
import type { WeekProgress } from './api'

/*
 * Hand-rolled SVG charts for the objective page. Identity is carried by
 * geometry, not color alone: actuals are filled bars / a solid accent line,
 * targets are tick caps / a muted context line with direct labels.
 * The viewBox width is measured from the container (1:1 with CSS pixels)
 * so tick text stays readable on narrow screens.
 */

const FALLBACK_W = 720
const H = 200
const PAD = { top: 16, right: 12, bottom: 24, left: 40 }
const PLOT_H = H - PAD.top - PAD.bottom

/** Clean axis ticks: 0 → a rounded max in 3 steps. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 3 >= max) ?? raw
  return [0, 1, 2, 3].map((i) => Math.round(i * step))
}

/** Week labels every Nth column, denser when the chart has room. */
function weekLabelStep(band: number): number {
  return Math.max(1, Math.ceil(36 / band))
}

/** Bar with a 4px rounded data-end and a square baseline. */
function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height)
  const bottom = y + height
  return `M ${x} ${bottom} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${bottom} Z`
}

interface TooltipState {
  index: number
  x: number
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  // Flip sides at the middle so the tooltip never overflows the card
  const leftHalf = x < width / 2
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-xs shadow-sm dark:border-moss-750 dark:bg-moss-850"
      style={
        leftHalf
          ? { left: `${((x + 14) / width) * 100}%` }
          : { right: `${(1 - (x - 14) / width) * 100}%` }
      }
    >
      {children}
    </div>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-moss-500 dark:text-moss-400">
      <span className={className} aria-hidden />
      {label}
    </span>
  )
}

export type Metric = 'volume' | 'elevation'

const METRIC = {
  volume: {
    unit: 'km',
    target: (w: WeekProgress) => w.targetVolumeKm ?? 0,
    actual: (w: WeekProgress) => w.actualVolumeKm,
    round: (v: number) => Math.round(v * 10) / 10,
  },
  elevation: {
    unit: 'm D+',
    target: (w: WeekProgress) => w.targetElevationM ?? 0,
    actual: (w: WeekProgress) => w.actualElevationM,
    round: (v: number) => Math.round(v),
  },
} as const

interface RaceMarker {
  weekIndex: number
  name: string
}

interface WeeklyChartProps {
  weeks: WeekProgress[]
  metric: Metric
  races: RaceMarker[]
}

/** Weekly bars: actual filled in pine, the week's target as a muted tick cap. */
export function WeeklyChart({ weeks, metric, races }: WeeklyChartProps) {
  const { t } = useTranslation('objective')
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<TooltipState | null>(null)
  const m = METRIC[metric]
  const plotW = width - PAD.left - PAD.right

  const max = Math.max(...weeks.map((w) => Math.max(m.target(w), m.actual(w))), 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H

  const band = plotW / weeks.length
  const barWidth = Math.min(24, band * 0.6)
  const barX = (i: number) => PAD.left + i * band + (band - barWidth) / 2
  const step = weekLabelStep(band)

  const raceByWeek = new Map(races.map((r) => [r.weekIndex, r]))

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex items-center gap-4">
        <LegendSwatch
          className="h-2.5 w-2.5 rounded-[3px] bg-pine-600 dark:bg-pine-350"
          label={t('charts.actual')}
        />
        <LegendSwatch className="h-[2px] w-3 bg-moss-400 dark:bg-moss-500" label={t('charts.target')} />
        {races.length > 0 && (
          <LegendSwatch
            className="h-2 w-2 rounded-full bg-copper-600 dark:bg-copper-300"
            label={t('charts.race')}
          />
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label={t('charts.weeklyAria')}>
        {ticks.map((t) => (
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
              {t.toLocaleString(numberLocale())}
            </text>
          </g>
        ))}

        {weeks.map((week, i) => {
          const actual = m.actual(week)
          const target = m.target(week)
          const isHovered = hover?.index === i
          return (
            <g key={week.weekId}>
              {week.current && (
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={PLOT_H}
                  className="fill-pine-100 dark:fill-pine-900"
                  opacity={0.6}
                />
              )}
              {actual > 0 && (
                <path
                  d={roundedTopBar(barX(i), y(actual), barWidth, y(0) - y(actual))}
                  className="fill-pine-600 dark:fill-pine-350"
                  opacity={isHovered ? 1 : 0.9}
                />
              )}
              {target > 0 && (
                <line
                  x1={PAD.left + i * band + band * 0.12}
                  x2={PAD.left + (i + 1) * band - band * 0.12}
                  y1={y(target)}
                  y2={y(target)}
                  className="stroke-moss-400 dark:stroke-moss-500"
                  strokeWidth={2}
                />
              )}
              {raceByWeek.has(i) && (
                <circle
                  cx={PAD.left + i * band + band / 2}
                  cy={PAD.top - 8}
                  r={4}
                  className="fill-copper-600 dark:fill-copper-300"
                />
              )}
              {(i === 0 || (i + 1) % step === 0 || week.current) && (
                <text
                  x={PAD.left + i * band + band / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className={
                    week.current
                      ? 'fill-ink text-[10px] font-semibold dark:fill-linen'
                      : 'fill-moss-500 text-[10px] dark:fill-moss-400'
                  }
                >
                  {t('charts.weekShort', { number: week.weekNumber })}
                </text>
              )}
              <rect
                x={PAD.left + i * band}
                y={PAD.top - 14}
                width={band}
                height={PLOT_H + 14}
                fill="transparent"
                onMouseEnter={() => setHover({ index: i, x: PAD.left + i * band + band / 2 })}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>

      {hover && (
        <Tooltip x={hover.x} width={width}>
          {(() => {
            const week = weeks[hover.index]
            const race = raceByWeek.get(hover.index)
            return (
              <>
                <p className="font-semibold">
                  {t('charts.week', { number: week.weekNumber })}
                  <span className="ml-1 font-normal text-moss-500 dark:text-moss-400">
                    {format(parseISO(week.startDate), 'd MMM', { locale: dateLocale() })}
                  </span>
                </p>
                <dl className="mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <dt className="text-moss-500 dark:text-moss-400">{t('charts.actual')}</dt>
                    <dd className="font-medium">
                      {m.round(m.actual(week)).toLocaleString(numberLocale())} {m.unit}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-moss-500 dark:text-moss-400">{t('charts.target')}</dt>
                    <dd>{m.round(m.target(week)).toLocaleString(numberLocale())} {m.unit}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-moss-500 dark:text-moss-400">{t('charts.sessions')}</dt>
                    <dd>
                      {week.sessionsDone}/{week.sessionsPlanned}
                    </dd>
                  </div>
                </dl>
                {race && <p className="mt-1 text-copper-600 dark:text-copper-300">🏁 {race.name}</p>}
              </>
            )
          })()}
        </Tooltip>
      )}
    </div>
  )
}

interface CumulativeChartProps {
  weeks: WeekProgress[]
  metric: Metric
}

/**
 * Cumulative target (muted, full season) vs cumulative actual (accent,
 * stops at the current week) — "where I am vs where the plan says".
 */
export function CumulativeChart({ weeks, metric }: CumulativeChartProps) {
  const { t } = useTranslation('objective')
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<TooltipState | null>(null)
  const m = METRIC[metric]
  const plotW = width - PAD.left - PAD.right

  const { targetCum, actualCum, actualEnd } = useMemo(() => {
    const target: number[] = []
    const actual: number[] = []
    let t = 0
    let a = 0
    let end = -1
    weeks.forEach((week, i) => {
      t += m.target(week)
      a += m.actual(week)
      target.push(t)
      actual.push(a)
      if (week.current || m.actual(week) > 0) end = Math.max(end, i)
    })
    return { targetCum: target, actualCum: actual, actualEnd: end }
  }, [weeks, m])

  const max = Math.max(targetCum[targetCum.length - 1] ?? 0, actualCum[actualEnd] ?? 0, 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H
  const x = (i: number) => PAD.left + (weeks.length === 1 ? plotW / 2 : (i / (weeks.length - 1)) * plotW)
  const step = weekLabelStep(plotW / Math.max(weeks.length, 1))

  const path = (values: number[], end: number) =>
    values
      .slice(0, end + 1)
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`)
      .join(' ')

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex items-center gap-4">
        <LegendSwatch className="h-[2px] w-4 rounded bg-pine-600 dark:bg-pine-350" label={t('charts.actual')} />
        <LegendSwatch className="h-[2px] w-4 rounded bg-moss-400 dark:bg-moss-500" label={t('charts.planned')} />
      </div>
      <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label={t('charts.cumulativeAria')}>
        {ticks.map((t) => (
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
              {t.toLocaleString(numberLocale())}
            </text>
          </g>
        ))}

        <path
          d={path(targetCum, weeks.length - 1)}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-moss-400 dark:stroke-moss-500"
        />
        {actualEnd >= 0 && (
          <>
            <path
              d={path(actualCum, actualEnd)}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-pine-600 dark:stroke-pine-350"
            />
            <circle
              cx={x(actualEnd)}
              cy={y(actualCum[actualEnd])}
              r={4}
              className="fill-pine-600 stroke-moss-25 dark:fill-pine-350 dark:stroke-moss-850"
              strokeWidth={2}
            />
          </>
        )}

        {hover && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            className="stroke-moss-300 dark:stroke-moss-700"
            strokeWidth={1}
          />
        )}

        {weeks.map((week, i) => (
          <g key={week.weekId}>
            {(i === 0 || (i + 1) % step === 0 || week.current) && (
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className={
                  week.current
                    ? 'fill-ink text-[10px] font-semibold dark:fill-linen'
                    : 'fill-moss-500 text-[10px] dark:fill-moss-400'
                }
              >
                {t('charts.weekShort', { number: week.weekNumber })}
              </text>
            )}
            <rect
              x={PAD.left + (i - 0.5) * (plotW / Math.max(weeks.length - 1, 1))}
              y={PAD.top}
              width={plotW / Math.max(weeks.length - 1, 1)}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover({ index: i, x: x(i) })}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      {hover && (
        <Tooltip x={hover.x} width={width}>
          {(() => {
            const week = weeks[hover.index]
            return (
              <>
                <p className="font-semibold">{t('charts.week', { number: week.weekNumber })}</p>
                <dl className="mt-1 space-y-0.5">
                  {hover.index <= actualEnd && (
                    <div className="flex justify-between">
                      <dt className="text-moss-500 dark:text-moss-400">{t('charts.actual')}</dt>
                      <dd className="font-medium">
                        {m.round(actualCum[hover.index]).toLocaleString(numberLocale())} {m.unit}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-moss-500 dark:text-moss-400">{t('charts.planned')}</dt>
                    <dd>{m.round(targetCum[hover.index]).toLocaleString(numberLocale())} {m.unit}</dd>
                  </div>
                </dl>
              </>
            )
          })()}
        </Tooltip>
      )}
    </div>
  )
}
