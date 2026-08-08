import { useSyncExternalStore } from 'react'

import { chime, HOLD_DONE_NOTES } from './chime'

const STORAGE_KEY = 'cavale.hold'

/**
 * The timer for an effort measured in seconds rather than reps — a plank, a
 * wall sit, a dead hang.
 *
 * Same trick as the rest countdown ([[restClock]]): what is stored is the
 * INSTANT THE HOLD STARTED, never a number ticking down, so the elapsed time
 * is recomputed from the wall clock whenever anyone asks. A plank is exactly
 * when a phone gets put face-down on the mat, and a timer kept in component
 * state would die there.
 *
 * It counts DOWN to the prescribed target and then keeps going, into
 * overtime, rather than stopping: holding four seconds longer than asked is a
 * good set, and the athlete should get credit for the seconds they actually
 * held. Stopping reports the real elapsed time, which is what gets logged.
 */
export interface HoldSnapshot {
  /** Which set is being timed — null when nothing is running. */
  key: string | null
  /** Seconds held so far. */
  elapsed: number
  /** The prescription this hold is counting down to. */
  target: number
  /** Elapsed has passed the target — the set is already good. */
  over: boolean
}

const IDLE: HoldSnapshot = { key: null, elapsed: 0, target: 0, over: false }

interface Stored {
  key: string
  startedAt: number
  target: number
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    if (!parsed || typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

class HoldClock {
  private current: Stored | null = read()
  private rang = false
  private listeners = new Set<() => void>()
  private ticker: ReturnType<typeof setInterval> | null = null
  private snapshot: HoldSnapshot = IDLE

  constructor() {
    if (typeof document !== 'undefined') {
      // back from a dark screen: recompute rather than trust anything
      const resync = () => {
        this.current = read()
        this.refresh()
      }
      document.addEventListener('visibilitychange', resync)
      window.addEventListener('focus', resync)
    }
    this.refresh()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    this.ensureTicking()
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): HoldSnapshot => this.snapshot

  private ensureTicking() {
    if (this.current != null && this.ticker == null) {
      this.ticker = setInterval(() => this.refresh(), 200)
    } else if (this.current == null && this.ticker != null) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  private refresh() {
    const held = this.current
    // One reading of the clock for the whole snapshot — two calls could land
    // either side of a second and report an elapsed that disagrees with `over`.
    const now = Date.now()
    const elapsed = held == null ? 0 : Math.max(0, Math.floor((now - held.startedAt) / 1000))
    const next: HoldSnapshot = held == null
      ? IDLE
      : { key: held.key, elapsed, target: held.target, over: elapsed >= held.target }

    // Ring once, as the target is reached — after that the athlete is in
    // overtime and does not need to be told again.
    if (next.over && !this.rang && held != null && held.target > 0) {
      this.rang = true
      chime.play(HOLD_DONE_NOTES)
    }

    const changed =
      next.key !== this.snapshot.key ||
      next.elapsed !== this.snapshot.elapsed ||
      next.target !== this.snapshot.target ||
      next.over !== this.snapshot.over
    this.snapshot = next
    this.ensureTicking()
    if (changed) this.listeners.forEach((l) => l())
  }

  private write(value: Stored | null) {
    try {
      if (value == null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* private mode — the timer still works for this page's lifetime */
    }
  }

  /** @param key identifies the set, so a stale hold can't bleed into another */
  start(key: string, target: number) {
    chime.unlock() // this call always comes from a tap
    const value: Stored = { key, startedAt: Date.now(), target: Math.max(0, target) }
    this.write(value)
    this.current = value
    this.rang = false
    this.refresh()
  }

  /** @returns the seconds actually held, for the caller to log */
  stop(): number {
    const elapsed = this.snapshot.elapsed
    this.write(null)
    this.current = null
    this.rang = false
    this.refresh()
    return elapsed
  }

  /** Drop the hold without reporting it — used when the set changes underfoot. */
  cancel() {
    if (this.current == null) return
    this.write(null)
    this.current = null
    this.rang = false
    this.refresh()
  }
}

export const holdClock = new HoldClock()

export function useHoldClock(): HoldSnapshot {
  return useSyncExternalStore(holdClock.subscribe, holdClock.getSnapshot, holdClock.getSnapshot)
}
