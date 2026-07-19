import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeasuredWidth } from '../lib/useMeasuredWidth'
import type { ActivityStreams } from '../features/calendar/api'

/* ── Charts — one series each, hover crosshair, Massif tokens ──────────
   Shared by the session report and the standalone activity detail page. */

export function StreamCharts({ streams }: { streams: ActivityStreams }) {
  const { t } = useTranslation('calendar')
  const km = streams.distance.map((d) => d / 1000)

  const altitude = useMemo(
    () => km.map((x, i) => ({ x, y: streams.alt[i] })).filter((p) => p.y != null),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pace = useMemo(
    () =>
      km
        .map((x, i) => ({ x, y: streams.vel[i] }))
        .filter((p) => p.y != null && p.y > 0.5)
        .map((p) => ({ x: p.x, y: 1000 / p.y / 60 })), // min per km
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const hr = useMemo(
    () => km.map((x, i) => ({ x, y: streams.hr[i] })).filter((p) => p.y != null && p.y > 0),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fmtPace = (y: number) => {
    const sec = Math.round(y * 60)
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`
  }

  return (
    <div className="mt-4 space-y-3">
      {altitude.length > 1 && (
        <StreamChart
          title={t('report.chartElevation')}
          points={altitude}
          colorClass="text-pine-600 dark:text-pine-350"
          area
          yFormat={(y) => `${Math.round(y)} m`}
        />
      )}
      {pace.length > 1 && (
        <StreamChart
          title={t('report.chartPace')}
          points={pace}
          colorClass="text-teal-600 dark:text-teal-300"
          invertY
          yFormat={fmtPace}
        />
      )}
      {hr.length > 1 && (
        <StreamChart
          title={t('report.chartHr')}
          points={hr}
          colorClass="text-rowan-600 dark:text-rowan-300"
          yFormat={(y) => `${Math.round(y)} bpm`}
        />
      )}
    </div>
  )
}

const FALLBACK_W = 600
const H = 150
const PAD = { left: 8, right: 8, top: 10, bottom: 18 }

function StreamChart({
  title,
  points,
  colorClass,
  yFormat,
  area = false,
  invertY = false,
}: {
  title: string
  points: { x: number; y: number }[]
  colorClass: string
  yFormat: (y: number) => string
  area?: boolean
  invertY?: boolean
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

  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => {
    const t = (y - yMin) / (yMax - yMin || 1)
    const tt = invertY ? t : 1 - t
    return PAD.top + tt * (H - PAD.top - PAD.bottom)
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const baseline = invertY ? PAD.top : H - PAD.bottom
  const areaPath = `${line}L${sx(xMax).toFixed(1)},${baseline}L${sx(xMin).toFixed(1)},${baseline}Z`

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

  return (
    <figure className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {title}
        </span>
        <span className="text-xs font-medium tabular-nums">
          {hovered ? `${hovered.x.toFixed(1)} km · ${yFormat(hovered.y)}` : ' '}
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
          {/* recessive grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + t * (H - PAD.top - PAD.bottom)}
              y2={PAD.top + t * (H - PAD.top - PAD.bottom)}
              className="stroke-moss-200 dark:stroke-moss-750"
              strokeWidth="1"
            />
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
