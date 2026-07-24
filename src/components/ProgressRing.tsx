/** Circular completion gauge. The arc uses `currentColor`, so pass a `text-*`
 *  class (with its `dark:` variant) to color it — one metric, one color,
 *  everywhere. */

/** Metric → arc color, shared by every completion-ring surface so a metric is
 *  recognizable across the weekly header and the season list. */
export const RING_COLORS = {
  volume: 'text-pine-600 dark:text-pine-350',
  time: 'text-teal-600 dark:text-teal-300',
  elevation: 'text-copper-600 dark:text-copper-300',
  load: 'text-rowan-600 dark:text-rowan-300',
} as const

export function ProgressRing({
  ratio,
  size = 44,
  strokeWidth = 4,
  label,
  sub,
  subClassName,
  center,
  title,
  className = '',
}: {
  /** actual / target. Values above 1 render a full ring with the real percent. */
  ratio: number
  size?: number
  strokeWidth?: number
  /** Metric name shown under the ring. */
  label: string
  /** Optional compact "actual/target" line under the label. */
  sub?: string
  subClassName?: string
  /** Replaces the percent readout with stacked actual value over target detail
   *  (needs a large enough `size` to stay legible). The percent moves to the
   *  aria-label. */
  center?: { value: string; detail: string }
  title?: string
  /** Arc color as a text class, e.g. `RING_COLORS.volume`. */
  className?: string
}) {
  const percent = Math.max(0, Math.round(ratio * 100))
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const filled = Math.min(Math.max(ratio, 0), 1) * circumference
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5" title={title}>
      <div className={`relative ${className}`} role="img" aria-label={`${label} ${percent}%`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-moss-200 dark:stroke-moss-750"
          />
          {filled > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={`${filled} ${circumference - filled}`}
            />
          )}
        </svg>
        {center ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
            <span
              className="font-semibold text-ink dark:text-linen"
              style={{ fontSize: Math.max(11, Math.round(size * 0.17)) }}
            >
              {center.value}
            </span>
            <span
              className={subClassName ?? 'text-moss-500 dark:text-moss-400'}
              style={{ fontSize: Math.max(9, Math.round(size * 0.11)) }}
            >
              {center.detail}
            </span>
          </span>
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-ink dark:text-linen"
            style={{ fontSize: Math.max(9, Math.round(size * 0.22)) }}
          >
            {percent}%
          </span>
        )}
      </div>
      <span
        className="truncate text-[11px] font-medium text-moss-500 dark:text-moss-400"
        style={{ maxWidth: size }}
      >
        {label}
      </span>
      {sub && (
        <span
          className={`text-[11px] whitespace-nowrap tabular-nums ${
            subClassName ?? 'text-moss-500 dark:text-moss-400'
          }`}
        >
          {sub}
        </span>
      )}
    </div>
  )
}
