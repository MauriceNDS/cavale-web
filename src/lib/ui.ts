/** Shared Tailwind class strings used verbatim across features — one source of
 *  truth so a token change lands everywhere at once. */

/** Muted/secondary text (light → dark). */
export const muted = 'text-moss-500 dark:text-moss-400'

/** The standard content card: rounded border on the card background. */
export const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'

/** Touch-scrub surfaces (chart crosshairs…): kill text selection AND the iOS
 *  long-press callout — plain `select-none` is not enough on iOS Safari. */
export const scrubSurface = 'select-none [-webkit-user-select:none] [-webkit-touch-callout:none]'
