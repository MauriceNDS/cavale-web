/** Pill-style segmented toggle (the pattern born in the planning header's
 *  week/month switch). Controlled; one option is always active. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}) {
  const pad = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex w-fit rounded-lg border border-moss-200 p-0.5 dark:border-moss-750 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md ${pad} font-medium whitespace-nowrap transition [touch-action:manipulation] ${
            value === o.value
              ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
              : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
