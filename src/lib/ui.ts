/** Shared Tailwind class strings used verbatim across features — one source of
 *  truth so a token change lands everywhere at once. */

/** Muted/secondary text (light → dark). */
export const muted = 'text-moss-500 dark:text-moss-400'

/** The standard content card: rounded border on the card background. */
export const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'

/** Touch-scrub surfaces (chart crosshairs…): kill text selection AND the iOS
 *  long-press callout — plain `select-none` is not enough on iOS Safari. */
export const scrubSurface = 'select-none [-webkit-user-select:none] [-webkit-touch-callout:none]'

/**
 * The stacking order of everything that floats, from the page up. Anything
 * `fixed` or `sticky` picks a rung here instead of inventing a number —
 * that is how the gym timer ended up covering the keypad it was supposed to
 * sit behind.
 *
 * The rule that decides the order: a dialog is something you opened on
 * purpose and must be able to read and dismiss, so nothing ever covers it.
 * Ambient chrome (the tab bar, the rest countdown) is below it, always.
 */
export const layer = {
  /** In-page sticky headers and action bars — they scroll with a page. */
  sticky: 'z-30',
  /** App shell chrome: bottom tab bar, sidebar, public header. */
  chrome: 'z-40',
  /** The rest countdown: over the chrome it is pinned above, under dialogs. */
  restBar: 'z-[45]',
  /** Modals, sheets, confirmations. Nothing is allowed above this. */
  dialog: 'z-50',
} as const
