import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeasuredWidth } from '../lib/useMeasuredWidth'
import { scrubSurface } from '../lib/ui'
import { SegmentedControl } from './SegmentedControl'
import { allureLabel } from '../features/calendar/labels'
import type { ActivityStreams, Allure, Terrain, WorkoutNode } from '../features/calendar/api'

/* ── Activity analysis: km splits + stream charts ──────────────────────
   Shared by the session report and the standalone activity detail page.
   One chart visible at a time (phone-first): linear curves over distance
   (with the elevation profile as a muted backdrop), per-kilometre bars
   derived from the splits, and — when the session prescribed a structured
   workout — per-segment bars sliced on the planned step durations. */

interface Point {
  x: number
  y: number
}

/** Centered moving average — GPS pace is too jittery to plot raw. */
function smooth(points: Point[], radius: number): Point[] {
  return points.map((p, i) => {
    const from = Math.max(0, i - radius)
    const to = Math.min(points.length - 1, i + radius)
    let sum = 0
    for (let j = from; j <= to; j++) sum += points[j].y
    return { x: p.x, y: sum / (to - from + 1) }
  })
}

const fmtPaceCompact = (minPerKm: number) => {
  const sec = Math.round(minPerKm * 60)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/* ── Km splits ─────────────────────────────────────────────────────── */

interface Split {
  /** "1", "2", … or the partial-distance label for the last bin. */
  label: string
  distKm: number
  paceSecPerKm: number
  avgHr: number | null
  dplus: number
}

/** Cut the streams into 1-km bins, splitting samples across boundaries. */
function computeSplits(streams: ActivityStreams): Split[] {
  const { time, distance, hr, alt } = streams
  const n = Math.min(time.length, distance.length)
  if (n < 2) return []

  interface Bin {
    sec: number
    distKm: number
    dplus: number
    hrWeighted: number
    hrSec: number
  }
  const bins: Bin[] = []
  const bin = (i: number): Bin => {
    while (bins.length <= i) bins.push({ sec: 0, distKm: 0, dplus: 0, hrWeighted: 0, hrSec: 0 })
    return bins[i]
  }

  for (let i = 1; i < n; i++) {
    let d0 = distance[i - 1] / 1000
    const d1 = distance[i] / 1000
    const t0 = time[i - 1]
    const t1 = time[i]
    if (d1 <= d0 || t1 <= t0) continue
    const climb = alt?.[i] != null && alt?.[i - 1] != null ? Math.max(0, alt[i] - alt[i - 1]) : 0
    const sampleHr = hr?.[i] != null && hr[i] > 0 ? hr[i] : null
    const totalDist = d1 - d0
    const totalSec = t1 - t0

    // Walk the segment, chopping it at each km boundary it crosses.
    while (d0 < d1) {
      const binIndex = Math.floor(d0)
      const boundary = Math.min(d1, binIndex + 1)
      const fraction = (boundary - d0) / totalDist
      const sec = totalSec * fraction
      const b = bin(binIndex)
      b.distKm += boundary - d0
      b.sec += sec
      b.dplus += climb * fraction
      if (sampleHr != null) {
        b.hrWeighted += sampleHr * sec
        b.hrSec += sec
      }
      d0 = boundary
    }
  }

  const splits: Split[] = []
  bins.forEach((b, i) => {
    if (b.distKm <= 0 || b.sec <= 0) return
    const partial = b.distKm < 0.995
    if (partial && b.distKm < 0.2) return // GPS crumbs, not a split
    splits.push({
      label: partial ? (i + b.distKm).toFixed(1) : String(i + 1),
      distKm: b.distKm,
      paceSecPerKm: Math.round(b.sec / b.distKm),
      avgHr: b.hrSec > 0 ? Math.round(b.hrWeighted / b.hrSec) : null,
      dplus: Math.round(b.dplus),
    })
  })
  return splits
}

/* ── Workout segments ──────────────────────────────────────────────── */

interface FlatStep {
  allure: Allure | null
  terrain: Terrain | null
  seconds: number
}

/** Expand the workout tree (repeats included) into a flat list of timed
 *  steps. Returns null when any step lacks a duration — slicing the streams
 *  would then be a guess, so the per-segment mode must not appear. */
function flattenWorkout(nodes: WorkoutNode[]): FlatStep[] | null {
  const out: FlatStep[] = []
  for (const node of nodes) {
    if (node.type === 'step') {
      if (node.seconds == null || node.seconds <= 0) return null
      out.push({ allure: node.allure, terrain: node.terrain, seconds: node.seconds })
    } else {
      if (node.count == null || node.count <= 0 || !node.children?.length) return null
      const inner = flattenWorkout(node.children)
      if (inner == null) return null
      for (let k = 0; k < node.count; k++) out.push(...inner)
    }
  }
  return out
}

interface Segment {
  index: number
  allure: Allure | null
  plannedSec: number
  actualSec: number
  distKm: number
  paceSecPerKm: number | null
  avgHr: number | null
  dplus: number
}

/** Same fractional apportioning as computeSplits, but chopped on the
 *  cumulative planned-step time boundaries instead of km marks. Stream time
 *  beyond the last boundary (cool-down overshoot) is dropped. */
function computeSegments(streams: ActivityStreams, steps: FlatStep[]): Segment[] {
  const { time, distance, hr, alt } = streams
  const n = Math.min(time.length, distance.length)
  if (n < 2) return []

  const bounds: number[] = []
  let acc = time[0]
  for (const step of steps) {
    acc += step.seconds
    bounds.push(acc)
  }

  interface Acc {
    actualSec: number
    distKm: number
    dplus: number
    hrWeighted: number
    hrSec: number
  }
  const accs: Acc[] = steps.map(() => ({
    actualSec: 0,
    distKm: 0,
    dplus: 0,
    hrWeighted: 0,
    hrSec: 0,
  }))

  let k = 0 // current segment — boundaries and samples both advance in time
  for (let i = 1; i < n; i++) {
    let t0 = time[i - 1]
    const t1 = time[i]
    if (t1 <= t0) continue
    const distKm = Math.max(0, distance[i] - distance[i - 1]) / 1000
    const climb = alt?.[i] != null && alt?.[i - 1] != null ? Math.max(0, alt[i] - alt[i - 1]) : 0
    const sampleHr = hr?.[i] != null && hr[i] > 0 ? hr[i] : null
    const totalSec = t1 - t0

    while (t0 < t1) {
      while (k < bounds.length && bounds[k] <= t0) k++
      if (k >= bounds.length) break // past the last planned step
      const boundary = Math.min(t1, bounds[k])
      const sec = boundary - t0
      const fraction = sec / totalSec
      const a = accs[k]
      a.actualSec += sec
      a.distKm += distKm * fraction
      a.dplus += climb * fraction
      if (sampleHr != null) {
        a.hrWeighted += sampleHr * sec
        a.hrSec += sec
      }
      t0 = boundary
    }
  }

  return steps.map((step, i) => {
    const a = accs[i]
    return {
      index: i,
      allure: step.allure,
      plannedSec: step.seconds,
      actualSec: Math.round(a.actualSec),
      distKm: a.distKm,
      paceSecPerKm: a.distKm > 0.01 && a.actualSec > 0 ? Math.round(a.actualSec / a.distKm) : null,
      avgHr: a.hrSec > 0 ? Math.round(a.hrWeighted / a.hrSec) : null,
      dplus: Math.round(a.dplus),
    }
  })
}

function SplitsTable({ splits }: { splits: Split[] }) {
  const { t } = useTranslation('calendar')
  const fastest = Math.min(...splits.map((s) => s.paceSecPerKm))
  const hasHr = splits.some((s) => s.avgHr != null)
  const hasDplus = splits.some((s) => s.dplus > 0)
  const cols = `2.25rem minmax(0,1fr)${hasHr ? ' 3rem' : ''}${hasDplus ? ' 3.25rem' : ''}`

  return (
    <div className="space-y-1 text-xs tabular-nums">
      <div
        className="grid items-center gap-2 text-[10px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400"
        style={{ gridTemplateColumns: cols }}
      >
        <span>{t('report.splitsKm')}</span>
        <span>{t('report.splitsPace')}</span>
        {hasHr && <span className="text-right">{t('report.splitsHr')}</span>}
        {hasDplus && <span className="text-right">{t('report.splitsDplus')}</span>}
      </div>
      {splits.map((split) => (
        <div
          key={split.label}
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: cols }}
        >
          <span className="text-moss-500 dark:text-moss-400">{split.label}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 shrink-0 rounded-full bg-pine-600/80 dark:bg-pine-350/80"
              style={{ width: `${Math.max(6, (fastest / split.paceSecPerKm) * 100)}%` }}
              aria-hidden
            />
            <span className="font-medium">{fmtPaceCompact(split.paceSecPerKm / 60)}</span>
          </span>
          {hasHr && (
            <span className="text-right text-moss-500 dark:text-moss-400">
              {split.avgHr ?? '—'}
            </span>
          )}
          {hasDplus && (
            <span className="text-right text-moss-500 dark:text-moss-400">
              {split.dplus > 0 ? `+${split.dplus} m` : '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Chart panel ───────────────────────────────────────────────────── */

type ChartMode = 'linear' | 'perKm' | 'perSegment'
type LinearTab = 'pace' | 'hr' | 'cadence' | 'elevation'
type KmTab = 'pace' | 'hr' | 'dplus'

export function StreamCharts({
  streams,
  workout,
}: {
  streams: ActivityStreams
  /** Planned workout structure of the linked session — enables the
   *  per-segment mode when the recorded duration matches the prescription. */
  workout?: WorkoutNode[]
}) {
  const { t } = useTranslation('calendar')
  const km = streams.distance.map((d) => d / 1000)

  const altitude = useMemo(
    () => km.map((x, i) => ({ x, y: streams.alt[i] })).filter((p) => p.y != null),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pace = useMemo(
    () =>
      smooth(
        km
          .map((x, i) => ({ x, y: streams.vel[i] }))
          .filter((p) => p.y != null && p.y > 0.5)
          .map((p) => ({ x: p.x, y: 1000 / p.y / 60 })), // min per km
        2,
      ),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const hr = useMemo(
    () => km.map((x, i) => ({ x, y: streams.hr[i] })).filter((p) => p.y != null && p.y > 0),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const cadence = useMemo(
    () =>
      smooth(
        km.map((x, i) => ({ x, y: streams.cad?.[i] ?? 0 })).filter((p) => p.y > 40),
        2,
      ),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const splits = useMemo(() => computeSplits(streams), [streams])

  // Per-segment slicing only makes sense when every step is timed AND the
  // recording roughly matches the plan (asymmetric band: athletes overshoot
  // with extra cool-down more often than they cut a workout short).
  const segments = useMemo(() => {
    const steps = workout && workout.length > 0 ? flattenWorkout(workout) : null
    if (!steps || steps.length < 2) return []
    const streamSec = streams.time[streams.time.length - 1] - streams.time[0]
    const plannedSec = steps.reduce((sum, s) => sum + s.seconds, 0)
    if (streamSec < 0.85 * plannedSec || streamSec > 1.25 * plannedSec) return []
    return computeSegments(streams, steps)
  }, [streams, workout])

  // Altitude at any chart x — feeds the second line of every crosshair readout.
  const altAt = useMemo(() => {
    if (altitude.length === 0) return () => null as number | null
    return (x: number): number | null => {
      let best = altitude[0]
      let bestDist = Infinity
      for (const p of altitude) {
        const d = Math.abs(p.x - x)
        if (d < bestDist) {
          bestDist = d
          best = p
        }
      }
      return best.y
    }
  }, [altitude])

  const backdrop = altitude.length > 1 ? altitude : undefined
  const fmtPace = (y: number) => `${fmtPaceCompact(y)} /km`

  const linearTabs: LinearTab[] = [
    ...(pace.length > 1 ? (['pace'] as const) : []),
    ...(hr.length > 1 ? (['hr'] as const) : []),
    ...(cadence.length > 1 ? (['cadence'] as const) : []),
    ...(altitude.length > 1 ? (['elevation'] as const) : []),
  ]
  const kmTabs: KmTab[] =
    splits.length >= 2
      ? [
          'pace' as const,
          ...(splits.some((s) => s.avgHr != null) ? (['hr'] as const) : []),
          ...(splits.some((s) => s.dplus > 0) ? (['dplus'] as const) : []),
        ]
      : []
  const segTabs: KmTab[] =
    segments.length >= 2
      ? [
          'pace' as const,
          ...(segments.some((s) => s.avgHr != null) ? (['hr'] as const) : []),
          ...(segments.some((s) => s.dplus > 0) ? (['dplus'] as const) : []),
        ]
      : []

  const [mode, setMode] = useState<ChartMode>('linear')
  const [linearSel, setLinearSel] = useState<LinearTab>('pace')
  const [kmSel, setKmSel] = useState<KmTab>('pace')
  const [segSel, setSegSel] = useState<KmTab>('pace')

  if (linearTabs.length === 0 && kmTabs.length === 0 && segTabs.length === 0) return null

  const tabsFor: Record<ChartMode, number> = {
    linear: linearTabs.length,
    perKm: kmTabs.length,
    perSegment: segTabs.length,
  }
  // Fall back gracefully when the picked mode has nothing to show.
  const effectiveMode: ChartMode =
    tabsFor[mode] > 0
      ? mode
      : (['linear', 'perKm', 'perSegment'] as const).find((m) => tabsFor[m] > 0)!
  const linearTab = linearTabs.includes(linearSel) ? linearSel : linearTabs[0]
  const kmTab = kmTabs.includes(kmSel) ? kmSel : kmTabs[0]
  const segTab = segTabs.includes(segSel) ? segSel : segTabs[0]

  const tabLabel: Record<LinearTab | KmTab, string> = {
    pace: t('report.tabPace'),
    hr: t('report.tabHr'),
    cadence: t('report.tabCadence'),
    elevation: t('report.tabElevation'),
    dplus: t('report.tabDplus'),
  }

  const linearChart = {
    elevation: (
      <StreamChart
        title={t('report.chartElevation')}
        points={altitude}
        colorClass="text-pine-600 dark:text-pine-350"
        area
        yFormat={(y) => `${Math.round(y)} m`}
        yTick={(y) => `${Math.round(y)}`}
      />
    ),
    pace: (
      <StreamChart
        title={t('report.chartPace')}
        points={pace}
        colorClass="text-teal-600 dark:text-teal-300"
        invertY
        yFormat={fmtPace}
        yTick={fmtPaceCompact}
        backdrop={backdrop}
        extraAt={altAt}
      />
    ),
    hr: (
      <StreamChart
        title={t('report.chartHr')}
        points={hr}
        colorClass="text-rowan-600 dark:text-rowan-300"
        yFormat={(y) => `${Math.round(y)} bpm`}
        yTick={(y) => `${Math.round(y)}`}
        backdrop={backdrop}
        extraAt={altAt}
      />
    ),
    cadence: (
      <StreamChart
        title={t('report.chartCadence')}
        points={cadence}
        colorClass="text-copper-600 dark:text-copper-300"
        yFormat={(y) => `${Math.round(y)} spm`}
        yTick={(y) => `${Math.round(y)}`}
        backdrop={backdrop}
        extraAt={altAt}
      />
    ),
  }[linearTab]

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {(() => {
          const modeOptions = [
            ...(linearTabs.length > 0
              ? [{ value: 'linear' as const, label: t('report.chartModeLinear') }]
              : []),
            ...(kmTabs.length > 0
              ? [{ value: 'perKm' as const, label: t('report.chartModePerKm') }]
              : []),
            ...(segTabs.length > 0
              ? [{ value: 'perSegment' as const, label: t('report.chartModePerSegment') }]
              : []),
          ]
          return modeOptions.length > 1 ? (
            <SegmentedControl
              size="sm"
              ariaLabel={t('report.chartModeAria')}
              options={modeOptions}
              value={effectiveMode}
              onChange={setMode}
            />
          ) : (
            <span />
          )
        })()}
        {effectiveMode === 'linear' && linearTabs.length > 1 && (
          <SegmentedControl
            size="sm"
            ariaLabel={t('report.chartMetricAria')}
            options={linearTabs.map((v) => ({ value: v, label: tabLabel[v] }))}
            value={linearTab}
            onChange={setLinearSel}
          />
        )}
        {effectiveMode === 'perKm' && kmTabs.length > 1 && (
          <SegmentedControl
            size="sm"
            ariaLabel={t('report.chartMetricAria')}
            options={kmTabs.map((v) => ({ value: v, label: tabLabel[v] }))}
            value={kmTab}
            onChange={setKmSel}
          />
        )}
        {effectiveMode === 'perSegment' && segTabs.length > 1 && (
          <SegmentedControl
            size="sm"
            ariaLabel={t('report.chartMetricAria')}
            options={segTabs.map((v) => ({ value: v, label: tabLabel[v] }))}
            value={segTab}
            onChange={setSegSel}
          />
        )}
      </div>
      {effectiveMode === 'linear' && linearChart}
      {effectiveMode === 'perKm' && (
        <>
          <KmBarChart splits={splits} metric={kmTab} />
          <details className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
            <summary className="cursor-pointer text-[11px] font-semibold tracking-wide text-moss-500 uppercase select-none dark:text-moss-400">
              {t('report.showSplitsTable')}
            </summary>
            <div className="mt-2">
              <SplitsTable splits={splits} />
            </div>
          </details>
        </>
      )}
      {effectiveMode === 'perSegment' && <SegmentBarChart segments={segments} metric={segTab} />}
    </div>
  )
}

const FALLBACK_W = 600
const H = 200
const PAD = { left: 38, right: 8, top: 10, bottom: 18 }

function StreamChart({
  title,
  points,
  colorClass,
  yFormat,
  yTick,
  area = false,
  invertY = false,
  backdrop,
  extraAt,
}: {
  title: string
  points: Point[]
  colorClass: string
  yFormat: (y: number) => string
  /** Compact y-axis tick label (no unit — the title carries it). */
  yTick: (y: number) => string
  area?: boolean
  invertY?: boolean
  /** Elevation profile drawn muted behind the metric, on its own scale. */
  backdrop?: Point[]
  /** Extra crosshair readout (altitude at x), shown after the y value. */
  extraAt?: (x: number) => number | null
}) {
  const { ref, width: W } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const xMin = points[0].x
  const xMax = points[points.length - 1].x
  const ys = points.map((p) => p.y)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  const padY = (yMax - yMin || 1) * 0.08
  yMin -= padY
  yMax += padY

  const plotH = H - PAD.top - PAD.bottom
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => {
    const t = (y - yMin) / (yMax - yMin || 1)
    return PAD.top + (invertY ? t : 1 - t) * plotH
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const baseline = invertY ? PAD.top : H - PAD.bottom
  const areaPath = `${line}L${sx(xMax).toFixed(1)},${baseline}L${sx(xMin).toFixed(1)},${baseline}Z`

  // Elevation backdrop on its own scale — terrain context, not a second axis.
  const backdropPath = useMemo(() => {
    if (!backdrop || backdrop.length < 2) return null
    const bys = backdrop.map((p) => p.y)
    const bMin = Math.min(...bys)
    const bMax = Math.max(...bys)
    const by = (y: number) => PAD.top + (1 - (y - bMin) / (bMax - bMin || 1)) * plotH
    const bLine = backdrop
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${by(p.y).toFixed(1)}`)
      .join('')
    return `${bLine}L${sx(backdrop[backdrop.length - 1].x).toFixed(1)},${H - PAD.bottom}L${sx(backdrop[0].x).toFixed(1)},${H - PAD.bottom}Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdrop, W, xMin, xMax])

  // Pointer events cover mouse AND touch: a finger drag scrubs the crosshair.
  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  const hovered = hover != null ? points[hover] : null
  const hoveredAlt = hovered && extraAt ? extraAt(hovered.x) : null

  // Grid values, top to bottom: the value shown at each hairline.
  const gridValue = (f: number) => (invertY ? yMin + f * (yMax - yMin) : yMax - f * (yMax - yMin))

  return (
    <figure
      className={`rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${scrubSurface}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {title}
        </span>
        <span className="truncate text-xs font-medium tabular-nums">
          {hovered
            ? `${hovered.x.toFixed(1)} km · ${yFormat(hovered.y)}${hoveredAlt != null ? ` · ${Math.round(hoveredAlt)} m` : ''}`
            : ' '}
        </span>
      </figcaption>
      <div ref={ref} className={colorClass}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 w-full touch-pan-y"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={title}
        >
          {backdropPath && (
            <path d={backdropPath} className="fill-moss-300/40 dark:fill-moss-700/40" stroke="none" />
          )}
          {/* recessive grid with value ticks */}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={PAD.top + f * plotH}
                y2={PAD.top + f * plotH}
                className="stroke-moss-200 dark:stroke-moss-750"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 5}
                y={PAD.top + f * plotH + 3}
                textAnchor="end"
                className="fill-moss-400 dark:fill-moss-500"
                fontSize="9"
              >
                {yTick(gridValue(f))}
              </text>
            </g>
          ))}
          {area && <path d={areaPath} fill="currentColor" opacity="0.15" stroke="none" />}
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          {hovered && (
            <>
              <line
                x1={sx(hovered.x)}
                x2={sx(hovered.x)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-moss-400 dark:stroke-moss-500"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={sx(hovered.x)} cy={sy(hovered.y)} r="4" fill="currentColor" />
            </>
          )}
          {/* x labels */}
          <text x={PAD.left} y={H - 4} className="fill-moss-400 dark:fill-moss-500" fontSize="10">
            {xMin.toFixed(0)} km
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-moss-400 dark:fill-moss-500" fontSize="10">
            {xMax.toFixed(1)} km
          </text>
        </svg>
      </div>
    </figure>
  )
}

/* ── Per-kilometre bars ────────────────────────────────────────────── */

const BAR_PAD = { left: 8, right: 8, top: 14, bottom: 18 }

function KmBarChart({ splits, metric }: { splits: Split[]; metric: KmTab }) {
  const { t } = useTranslation('calendar')
  const { ref, width: W } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [sel, setSel] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const conf = {
    pace: {
      colorClass: 'text-teal-600 dark:text-teal-300',
      title: t('report.chartPace'),
      // Taller bar = faster km: intuition-first, the label carries the pace.
      value: (s: Split) => 1000 / s.paceSecPerKm,
      barLabel: (s: Split) => fmtPaceCompact(s.paceSecPerKm / 60),
    },
    hr: {
      colorClass: 'text-rowan-600 dark:text-rowan-300',
      title: t('report.chartHr'),
      value: (s: Split) => s.avgHr,
      barLabel: (s: Split) => (s.avgHr != null ? String(s.avgHr) : ''),
    },
    dplus: {
      colorClass: 'text-copper-600 dark:text-copper-300',
      title: t('report.chartDplus'),
      value: (s: Split) => s.dplus,
      barLabel: (s: Split) => (s.dplus > 0 ? `+${s.dplus}` : ''),
    },
  }[metric]

  const values = splits.map(conf.value)
  const nums = values.filter((v): v is number => v != null)
  const vMin = Math.min(...nums)
  const vMax = Math.max(...nums)
  // D+ reads honestly from zero; pace/HR live in a narrow band, so bars span
  // it with a floor — otherwise every bar looks the same height.
  const heightShare = (v: number) =>
    metric === 'dplus' ? (vMax > 0 ? v / vMax : 0) : 0.2 + 0.8 * ((v - vMin) / (vMax - vMin || 1))

  const n = splits.length
  const plotH = H - BAR_PAD.top - BAR_PAD.bottom
  const slot = (W - BAR_PAD.left - BAR_PAD.right) / n
  const gap = Math.min(6, slot * 0.18)
  const barW = Math.max(2, slot - gap)
  const showBarLabels = slot >= 32
  const xLabelEvery = Math.ceil(n / 12)

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    const index = Math.floor((x - BAR_PAD.left) / slot)
    setSel(Math.min(n - 1, Math.max(0, index)))
  }

  const selected = sel != null ? splits[sel] : null
  const readout = selected
    ? [
        `${t('report.splitsKm')} ${selected.label}`,
        `${fmtPaceCompact(selected.paceSecPerKm / 60)} /km`,
        ...(selected.avgHr != null ? [`${selected.avgHr} bpm`] : []),
        ...(selected.dplus > 0 ? [`+${selected.dplus} m`] : []),
      ].join(' · ')
    : ' '

  return (
    <figure
      className={`rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${scrubSurface}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {conf.title}
        </span>
        <span className="truncate text-xs font-medium tabular-nums">{readout}</span>
      </figcaption>
      <div ref={ref} className={conf.colorClass}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 w-full touch-pan-y"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setSel(null)}
          role="img"
          aria-label={conf.title}
        >
          {splits.map((split, i) => {
            const v = values[i]
            const x = BAR_PAD.left + i * slot + gap / 2
            const isSel = sel === i
            const h = v != null ? Math.max(2, heightShare(v) * plotH) : 0
            const y = H - BAR_PAD.bottom - h
            return (
              <g key={split.label}>
                {v != null && (
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx="2"
                    fill="currentColor"
                    opacity={sel == null || isSel ? 0.9 : 0.45}
                  />
                )}
                {v != null && showBarLabels && (
                  <text
                    x={x + barW / 2}
                    y={y - 3}
                    textAnchor="middle"
                    className="fill-moss-500 dark:fill-moss-400"
                    fontSize="9"
                  >
                    {conf.barLabel(split)}
                  </text>
                )}
                {i % xLabelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H - 4}
                    textAnchor="middle"
                    className="fill-moss-400 dark:fill-moss-500"
                    fontSize="10"
                  >
                    {split.label}
                  </text>
                )}
              </g>
            )
          })}
          <line
            x1={BAR_PAD.left}
            x2={W - BAR_PAD.right}
            y1={H - BAR_PAD.bottom}
            y2={H - BAR_PAD.bottom}
            className="stroke-moss-200 dark:stroke-moss-750"
            strokeWidth="1"
          />
        </svg>
      </div>
    </figure>
  )
}

/* ── Per-segment bars ──────────────────────────────────────────────────
   One bar per planned workout step; the bar's WIDTH is its share of the
   planned time, so the chart reads like the workout's timeline. */

const fmtSegDuration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`
}

function SegmentBarChart({ segments, metric }: { segments: Segment[]; metric: KmTab }) {
  const { t } = useTranslation('calendar')
  const { ref, width: W } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [sel, setSel] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const conf = {
    pace: {
      colorClass: 'text-teal-600 dark:text-teal-300',
      title: t('report.chartPace'),
      // Taller bar = faster segment, same reading as the km bars.
      value: (s: Segment) => (s.paceSecPerKm != null ? 1000 / s.paceSecPerKm : null),
      barLabel: (s: Segment) =>
        s.paceSecPerKm != null ? fmtPaceCompact(s.paceSecPerKm / 60) : '',
    },
    hr: {
      colorClass: 'text-rowan-600 dark:text-rowan-300',
      title: t('report.chartHr'),
      value: (s: Segment) => s.avgHr,
      barLabel: (s: Segment) => (s.avgHr != null ? String(s.avgHr) : ''),
    },
    dplus: {
      colorClass: 'text-copper-600 dark:text-copper-300',
      title: t('report.chartDplus'),
      value: (s: Segment) => s.dplus,
      barLabel: (s: Segment) => (s.dplus > 0 ? `+${s.dplus}` : ''),
    },
  }[metric]

  const values = segments.map(conf.value)
  const nums = values.filter((v): v is number => v != null)
  const vMin = Math.min(...nums)
  const vMax = Math.max(...nums)
  const heightShare = (v: number) =>
    metric === 'dplus' ? (vMax > 0 ? v / vMax : 0) : 0.2 + 0.8 * ((v - vMin) / (vMax - vMin || 1))

  const totalSec = segments.reduce((sum, s) => sum + s.plannedSec, 0)
  const plotH = H - BAR_PAD.top - BAR_PAD.bottom
  const plotW = W - BAR_PAD.left - BAR_PAD.right
  // Bar geometry mirrors the workout timeline: x = cumulative planned time.
  let cursor = BAR_PAD.left
  const bars = segments.map((s) => {
    const w = (s.plannedSec / (totalSec || 1)) * plotW
    const bar = { x: cursor, w }
    cursor += w
    return bar
  })
  const gap = 2

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    let index = bars.findIndex((b) => x >= b.x && x < b.x + b.w)
    if (index === -1) index = x < BAR_PAD.left ? 0 : segments.length - 1
    setSel(index)
  }

  const selected = sel != null ? segments[sel] : null
  const readout = selected
    ? [
        `#${selected.index + 1}`,
        ...(selected.allure != null ? [allureLabel(selected.allure)] : []),
        ...(selected.paceSecPerKm != null
          ? [`${fmtPaceCompact(selected.paceSecPerKm / 60)} /km`]
          : []),
        ...(selected.avgHr != null ? [`${selected.avgHr} bpm`] : []),
        ...(selected.dplus > 0 ? [`+${selected.dplus} m`] : []),
        fmtSegDuration(selected.plannedSec),
      ].join(' · ')
    : ' '

  return (
    <figure
      className={`rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${scrubSurface}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {conf.title}
        </span>
        <span className="truncate text-xs font-medium tabular-nums">{readout}</span>
      </figcaption>
      <div ref={ref} className={conf.colorClass}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 w-full touch-pan-y"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setSel(null)}
          role="img"
          aria-label={conf.title}
        >
          {segments.map((segment, i) => {
            const v = values[i]
            const { x, w } = bars[i]
            const barW = Math.max(3, w - gap)
            const isSel = sel === i
            const h = v != null ? Math.max(2, heightShare(v) * plotH) : 0
            const y = H - BAR_PAD.bottom - h
            const showLabel = barW >= 30
            return (
              <g key={segment.index}>
                {v != null && (
                  <rect
                    x={x + gap / 2}
                    y={y}
                    width={barW}
                    height={h}
                    rx="2"
                    fill="currentColor"
                    opacity={sel == null || isSel ? 0.9 : 0.45}
                  />
                )}
                {v != null && showLabel && (
                  <text
                    x={x + gap / 2 + barW / 2}
                    y={y - 3}
                    textAnchor="middle"
                    className="fill-moss-500 dark:fill-moss-400"
                    fontSize="9"
                  >
                    {conf.barLabel(segment)}
                  </text>
                )}
                {showLabel && segment.allure != null && (
                  <text
                    x={x + gap / 2 + barW / 2}
                    y={H - 4}
                    textAnchor="middle"
                    className="fill-moss-400 dark:fill-moss-500"
                    fontSize="9"
                  >
                    {allureLabel(segment.allure)}
                  </text>
                )}
              </g>
            )
          })}
          <line
            x1={BAR_PAD.left}
            x2={W - BAR_PAD.right}
            y1={H - BAR_PAD.bottom}
            y2={H - BAR_PAD.bottom}
            className="stroke-moss-200 dark:stroke-moss-750"
            strokeWidth="1"
          />
        </svg>
      </div>
    </figure>
  )
}
