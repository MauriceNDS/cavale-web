import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { muted } from '../../lib/ui'
import { restClock, useRestClock } from './restClock'

export function formatCountdown(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * The countdown, wherever you happen to be.
 *
 * Rest is when people wander — to the calendar, to the coach's note — so
 * the bar lives in the app shell rather than on the workout page. The
 * runner renders its own richer version (it also asks for reps in
 * reserve), and says so, at which point this one stands down rather than
 * doubling up.
 */
export function RestBar({
  children,
  owned = false,
}: {
  /** Extra content under the countdown — the runner's rating question. */
  children?: React.ReactNode
  owned?: boolean
}) {
  const { t } = useTranslation('gym')
  const { secondsLeft, ringing, ownedByRunner } = useRestClock()

  if (!owned && ownedByRunner) return null
  if (secondsLeft == null && !ringing) return null

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 border-y border-moss-200 bg-moss-50/97 px-4 py-2.5 backdrop-blur md:bottom-0 md:border-b-0 md:pb-[max(0.625rem,env(safe-area-inset-bottom))] dark:border-moss-750 dark:bg-moss-900/97">
      <div className="mx-auto max-w-2xl">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition ${
            ringing
              ? 'animate-pulse bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
              : 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300'
          }`}
        >
          <p className="flex-1 font-display text-lg font-bold tabular-nums">
            {ringing
              ? t('workout.restOver')
              : t('workout.restCountdown', { time: formatCountdown(secondsLeft ?? 0) })}
          </p>
          {ringing ? (
            <button onClick={() => restClock.skip()} className="rounded-lg px-2.5 py-1.5 text-xs font-bold">
              {t('common:ok')}
            </button>
          ) : (
            <>
              <button onClick={() => restClock.extend(30)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold">
                {t('workout.restPlus30')}
              </button>
              <button onClick={() => restClock.skip()} className="rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-80">
                {t('workout.restSkip')}
              </button>
            </>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

/** Reps-in-reserve chips — dead time, so the question costs nothing. */
export function RirChips({
  value,
  onRate,
}: {
  value: number | null
  onRate: (rir: number) => void
}) {
  const { t } = useTranslation('gym')
  if (value != null) {
    return (
      <p className={`mt-1.5 text-center text-[11px] ${muted}`}>
        {t('workout.rirNoted', { rir: value })}
      </p>
    )
  }
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className={`text-xs ${muted}`}>{t('workout.rirQuestion')}</span>
      {[0, 1, 2, 3].map((rir) => (
        <button
          key={rir}
          onClick={() => onRate(rir)}
          className="h-9 min-w-9 flex-1 rounded-lg border border-moss-200 text-sm font-bold transition active:scale-95 hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800"
        >
          {rir === 3 ? '3+' : rir}
        </button>
      ))}
    </div>
  )
}

/** Tell the shell's bar to stand down while the runner is on screen. */
export function useOwnsRestBar() {
  useEffect(() => {
    restClock.setRunnerMounted(true)
    return () => restClock.setRunnerMounted(false)
  }, [])
}

/**
 * Keep the screen lit for the duration of a workout.
 *
 * On iOS the visual alarm IS the alarm — there is no vibration API and
 * sound dies on the silent switch — so a dark screen would mean no signal
 * at all. Browsers drop the lock when the tab goes to the background, so
 * it has to be re-taken on the way back.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // denied (low battery, unsupported) — the countdown still shows
      }
    }
    const reacquire = () => {
      if (document.visibilityState === 'visible' && sentinel?.released !== false) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', reacquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', reacquire)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
