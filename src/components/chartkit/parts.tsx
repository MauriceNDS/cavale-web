import { useState } from 'react'
import type { ReactNode } from 'react'
import { numberLocale } from '../../i18n'
import { muted } from '../../lib/ui'
import type { Frame } from './core'

/* ── SVG fragments ─────────────────────────────────────────────────── */

/** Horizontal gridlines + left-axis tick labels. */
export function GridY({
  frame,
  ticks,
  y,
  format,
}: {
  frame: Frame
  ticks: number[]
  y: (v: number) => number
  format?: (v: number) => string
}) {
  return (
    <>
      {[...new Set(ticks)].map((t) => (
        <g key={t}>
          <line
            x1={frame.pad.left}
            x2={frame.width - frame.pad.right}
            y1={y(t)}
            y2={y(t)}
            className="stroke-moss-200 dark:stroke-moss-750"
            strokeWidth={1}
          />
          <text
            x={frame.pad.left - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-moss-500 text-[10px] dark:fill-moss-400"
          >
            {format ? format(t) : Math.round(t).toLocaleString(numberLocale())}
          </text>
        </g>
      ))}
    </>
  )
}

/** X-axis labels under slot centers, thinned to the given step. */
export function XLabels({
  frame,
  count,
  x,
  label,
  step = 1,
}: {
  frame: Frame
  count: number
  x: (i: number) => number
  label: (i: number) => string
  step?: number
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) =>
        i % step === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={frame.height - 6}
            textAnchor="middle"
            className="fill-moss-500 text-[10px] dark:fill-moss-400"
          >
            {label(i)}
          </text>
        ) : null,
      )}
    </>
  )
}

/** Dashed horizontal threshold rule with a right-edge label. */
export function ThresholdLine({
  frame,
  y,
  label,
  className,
  labelClassName,
}: {
  frame: Frame
  y: number
  label?: string
  className: string
  labelClassName?: string
}) {
  return (
    <>
      <line
        x1={frame.pad.left}
        x2={frame.width - frame.pad.right}
        y1={y}
        y2={y}
        strokeWidth={1}
        strokeDasharray="4 3"
        className={className}
      />
      {label && (
        <text
          x={frame.width - frame.pad.right + 4}
          y={y + 3}
          textAnchor="start"
          className={`text-[10px] ${labelClassName ?? ''}`}
        >
          {label}
        </text>
      )}
    </>
  )
}

/* ── HTML fragments ────────────────────────────────────────────────── */

export interface LegendItem {
  /** Swatch background classes, e.g. "bg-pine-600 dark:bg-pine-350". */
  swatch: string
  label: string
  /** Optional current value shown after the label. */
  value?: string | number
  /** Render the swatch as a thin line instead of a block. */
  line?: boolean
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${muted}`}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block ${item.line ? 'h-[2px] w-4 rounded' : 'h-2 w-4 rounded-sm'} ${item.swatch}`}
          />
          {item.label}
          {item.value != null && <span className="font-medium text-ink dark:text-linen">{item.value}</span>}
        </span>
      ))}
    </div>
  )
}

/** Tiny inline trend line for verdict cards — no axes, no interaction. */
export function Sparkline({
  values,
  width = 72,
  height = 24,
  strokeClass = 'stroke-pine-600 dark:stroke-pine-350',
  baseline,
}: {
  values: number[]
  width?: number
  height?: number
  strokeClass?: string
  /** Draw a faint reference line at this value (e.g. 0 for form). */
  baseline?: number
}) {
  if (values.length < 2) return null
  const lo = Math.min(...values, baseline ?? Infinity)
  const hi = Math.max(...values, baseline ?? -Infinity)
  const span = hi - lo || 1
  const x = (i: number) => (i / (values.length - 1)) * (width - 2) + 1
  const y = (v: number) => 1 + (1 - (v - lo) / span) * (height - 2)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="shrink-0">
      {baseline != null && (
        <line
          x1={0}
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          strokeWidth={1}
          strokeDasharray="2 2"
          className="stroke-moss-300 dark:stroke-moss-700"
        />
      )}
      <path d={path} fill="none" strokeWidth={1.5} strokeLinejoin="round" className={strokeClass} />
    </svg>
  )
}

/* ── Collapsible chart section card ────────────────────────────────── */

const OPEN_KEY_PREFIX = 'cavale.stats.open.'

function storedOpen(id: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(OPEN_KEY_PREFIX + id)
  return raw == null ? fallback : raw === '1'
}

/**
 * Chart section with a collapsible body: the header always shows the title
 * and a compact "current value" summary, so a collapsed card still answers
 * at a glance. Open state persists per section.
 */
export function ChartCard({
  id,
  title,
  hint,
  summary,
  chip,
  defaultOpen = true,
  children,
}: {
  id: string
  title: string
  hint?: string
  /** Compact current-value line, always visible next to the title. */
  summary?: ReactNode
  /** Right-aligned chip (zone badges…), always visible. */
  chip?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => storedOpen(id, defaultOpen))
  const toggle = () => {
    setOpen(!open)
    localStorage.setItem(OPEN_KEY_PREFIX + id, open ? '0' : '1')
  }

  return (
    <section className="rounded-xl border border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-5 py-4 text-left"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 fill-moss-500 transition-transform dark:fill-moss-400 ${open ? 'rotate-90' : ''}`}
        >
          <path d="M6 3.5 11 8l-5 4.5v-9z" />
        </svg>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {summary != null && <span className={`text-sm ${muted}`}>{summary}</span>}
        {chip != null && <span className="ml-auto">{chip}</span>}
      </button>
      {open && (
        <div className="px-5 pb-5">
          {hint && <p className={`-mt-1 mb-3 text-xs ${muted}`}>{hint}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
