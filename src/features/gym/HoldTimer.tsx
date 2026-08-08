import { useTranslation } from 'react-i18next'
import { Pause, Play } from 'lucide-react'

import { holdClock, useHoldClock } from './holdClock'

/** "45″" while counting down, "+7″" once the prescription is beaten. */
function readout(elapsed: number, target: number): string {
  const remaining = target - elapsed
  return remaining > 0 ? `${remaining}″` : `+${elapsed - target}″`
}

/**
 * Times an effort held rather than counted — a plank, a wall sit, a dead hang.
 *
 * Typing "45" into the stepper afterwards is a guess; this counts the real
 * thing. It runs DOWN to the prescription and then keeps going into overtime
 * instead of stopping, because holding a few seconds longer is a better set,
 * not an error — and stopping logs the seconds actually held, whichever side
 * of the target they fall.
 *
 * Only one hold runs at a time (you can only plank one thing at once), so the
 * clock is keyed by set: arriving at a different set shows a fresh start
 * button rather than someone else's running count.
 */
export function HoldTimer({
  setKey,
  target,
  disabled,
  onHeld,
}: {
  /** Identifies this set, so a hold cannot bleed onto another exercise. */
  setKey: string
  /** Prescribed seconds — what the countdown runs to. */
  target: number
  disabled?: boolean
  /** Fires on stop with the seconds actually held. */
  onHeld: (seconds: number) => void
}) {
  const { t } = useTranslation('gym')
  const hold = useHoldClock()
  const running = hold.key === setKey

  if (disabled) return null

  if (!running) {
    return (
      <button
        onClick={() => holdClock.start(setKey, target)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-copper-600/40 bg-copper-600/10 font-semibold text-copper-600 transition active:scale-[0.98] dark:border-copper-300/40 dark:bg-copper-300/10 dark:text-copper-300"
      >
        <Play size={18} aria-hidden />
        {t('workout.holdStart', { count: target })}
      </button>
    )
  }

  return (
    <button
      onClick={() => onHeld(holdClock.stop())}
      aria-label={t('workout.holdStopAria')}
      className={`flex h-16 w-full items-center gap-3 rounded-xl px-4 transition active:scale-[0.98] ${
        hold.over
          ? 'animate-pulse bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
          : 'bg-copper-600 text-moss-25 dark:bg-copper-300 dark:text-moss-950'
      }`}
    >
      <span className="font-display text-3xl font-bold tabular-nums">
        {readout(hold.elapsed, hold.target)}
      </span>
      <span className="flex-1 text-left text-xs opacity-90">
        {hold.over
          ? t('workout.holdOver', { count: hold.target })
          : t('workout.holdCounting', { count: hold.target })}
      </span>
      <Pause size={20} aria-hidden />
    </button>
  )
}
