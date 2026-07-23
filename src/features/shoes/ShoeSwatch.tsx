/**
 * The pair's colour identity — a circle split diagonally when the shoe has a
 * secondary colour. This is how athletes recognise their pairs at a glance,
 * so it must stay readable on any card background: a subtle contrast ring
 * keeps white shoes visible in light mode and black ones in dark mode.
 * User-chosen hex values are data, not theme tokens — inline style is right.
 */
export function ShoeSwatch({
  color,
  colorSecondary,
  size = 'md',
  className = '',
}: {
  color: string | null | undefined
  colorSecondary?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = { sm: 16, md: 24, lg: 32 }[size]
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${
        color
          ? 'border border-ink/20 shadow-inner dark:border-linen/25'
          : 'border border-dashed border-moss-300 dark:border-moss-700'
      } ${className}`}
      style={{
        width: px,
        height: px,
        ...(color
          ? {
              background: colorSecondary
                ? `linear-gradient(135deg, ${color} 0 50%, ${colorSecondary} 50% 100%)`
                : color,
            }
          : {}),
      }}
    />
  )
}
