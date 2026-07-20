import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeasuredWidth } from '../lib/useMeasuredWidth'
import type { ActivityStreams } from '../features/calendar/api'

/* ── Activity analysis: km splits + stream charts ──────────────────────
   Shared by the session report and the standalone activity detail page.
   Every metric chart carries the elevation profile as a muted backdrop,
   so pace/HR/cadence read against the terrain that produced them. */

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

function SplitsTable({ splits }: { splits: Split[] }) {
  const { t } = useTranslation('calendar')
  const fastest = Math.min(...splits.map((s) => s.paceSecPerKm))
  const hasHr = splits.some((s) => s.avgHr != null)
  const hasDplus = splits.some((s) => s.dplus > 0)
  const cols = `2.25rem minmax(0,1fr)${hasHr ? ' 3rem' : ''}${hasDplus ? ' 3.25rem' : ''}`

  return (
    <figure className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <figcaption className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('report.splitsTitle')}
      </figcaption>
      <div className="mt-2 space-y-1 text-xs tabular-nums">
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
    </figure>
  )
}

/* ── Stream charts ─────────────────────────────────────────────────── */

export function StreamCharts({ streams }: { streams: ActivityStreams }) {
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

  return (
    <div className="mt-4 space-y-3">
      {splits.length > 0 && <SplitsTable splits={splits} />}
      {altitude.length > 1 && (
        <StreamChart
          title={t('report.chartElevation')}
          points={altitude}
          colorClass="text-pine-600 dark:text-pine-350"
          area
          yFormat={(y) => `${Math.round(y)} m`}
          yTick={(y) => `${Math.round(y)}`}
        />
      )}
      {pace.length > 1 && (
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
      )}
      {hr.length > 1 && (
        <StreamChart
          title={t('report.chartHr')}
          points={hr}
          colorClass="text-rowan-600 dark:text-rowan-300"
          yFormat={(y) => `${Math.round(y)} bpm`}
          yTick={(y) => `${Math.round(y)}`}
          backdrop={backdrop}
          extraAt={altAt}
        />
      )}
      {cadence.length > 1 && (
        <StreamChart
          title={t('report.chartCadence')}
          points={cadence}
          colorClass="text-copper-600 dark:text-copper-300"
          yFormat={(y) => `${Math.round(y)} spm`}
          yTick={(y) => `${Math.round(y)}`}
          backdrop={backdrop}
          extraAt={altAt}
        />
      )}
    </div>
  )
}

const FALLBACK_W = 600
const H = 150
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
    <figure className="rounded-xl border border-moss-200 bg-moss-25 p-3 select-none dark:border-moss-750 dark:bg-moss-850">
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
