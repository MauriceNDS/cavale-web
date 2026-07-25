import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMeasuredWidth } from '../../lib/useMeasuredWidth'
import { scrubSurface } from '../../lib/ui'
import { DEFAULT_PAD, bandX, makeFrame, type Frame, type Pad } from './core'

const FALLBACK_W = 720

export interface ChartSurfaceProps {
  height?: number
  pad?: Partial<Pad>
  ariaLabel: string
  /** Number of hoverable slots; 0 disables interactivity. */
  count?: number
  /** x of slot i for crosshair/tooltip anchoring; defaults to band centers. */
  xFor?: (i: number, frame: Frame) => number
  /** Tooltip content for slot i — null suppresses it for that slot. */
  tooltip?: (i: number) => ReactNode
  /** Click/tap on a slot — the drill-down hook. */
  onSelect?: (i: number) => void
  crosshair?: boolean
  children: (frame: Frame, hover: number | null) => ReactNode
}

/**
 * Measured, interactive SVG container: builds the viewBox at CSS-pixel scale,
 * owns hover state and hit strips, anchors the floating tooltip. Series and
 * grids are drawn by the caller via the render prop.
 */
export function ChartSurface({
  height = 210,
  pad,
  ariaLabel,
  count = 0,
  xFor,
  tooltip,
  onSelect,
  crosshair,
  children,
}: ChartSurfaceProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const frame = makeFrame(width, height, { ...DEFAULT_PAD, ...pad })
  const { band, left } = bandX(frame, count)
  const anchorX = (i: number) => (xFor ? xFor(i, frame) : left(i) + band / 2)

  const tooltipContent = hover != null && tooltip ? tooltip(hover) : null

  return (
    <div ref={ref} className={`relative ${scrubSurface}`} onPointerLeave={() => setHover(null)}>
      {tooltipContent != null && <TooltipBox x={anchorX(hover!)} width={width}>{tooltipContent}</TooltipBox>}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {children(frame, hover)}
        {crosshair && hover != null && (
          <line
            x1={anchorX(hover)}
            x2={anchorX(hover)}
            y1={frame.pad.top}
            y2={frame.pad.top + frame.plotH}
            className="stroke-moss-400 dark:stroke-moss-500"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {count > 0 && (tooltip || onSelect) &&
          Array.from({ length: count }, (_, i) => (
            <rect
              key={i}
              x={left(i)}
              y={0}
              width={band}
              height={height}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              onClick={onSelect ? () => onSelect(i) : undefined}
              className={onSelect ? 'cursor-pointer' : undefined}
            />
          ))}
      </svg>
    </div>
  )
}

function TooltipBox({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const leftHalf = x < width / 2
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-max max-w-52 rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-xs shadow-sm dark:border-moss-750 dark:bg-moss-850"
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

/** Stacked tooltip lines: first line bold (the bucket label), rest muted. */
export function TooltipLines({ lines }: { lines: (string | null | undefined)[] }) {
  const shown = lines.filter((line): line is string => !!line)
  return (
    <>
      {shown.map((line, i) => (
        <p key={i} className={i === 0 ? 'font-semibold' : 'text-moss-500 dark:text-moss-400'}>
          {line}
        </p>
      ))}
    </>
  )
}
