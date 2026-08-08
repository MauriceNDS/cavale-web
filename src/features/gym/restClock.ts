import { useSyncExternalStore } from 'react'

import { chime } from './chime'

const STORAGE_KEY = 'cavale.rest'
/** How long the "go" state stays up before fading back to nothing. */
const RINGING_MS = 8000

/**
 * The rest countdown, as ONE clock shared by the whole app.
 *
 * It is stored as the INSTANT IT ENDS rather than a number ticking down, so
 * it survives everything a phone does to a web page — locking the screen,
 * suspending the tab, a refresh, a navigation — because there is nothing to
 * keep running: what remains is recomputed from the wall clock whenever
 * anyone asks. The previous timer was a number in component state, so it
 * died the moment the screen went dark, which is exactly when a rest timer
 * is meant to be working.
 *
 * A single instance rather than a hook per component, because the bar is
 * rendered by the app shell (so you can wander off to the calendar and
 * still see your rest) while the runner renders its own richer version.
 */
export interface RestSnapshot {
  /** Seconds left, or null when nothing is running. */
  secondsLeft: number | null
  /** True briefly after zero — this is what drives the visual alarm. */
  ringing: boolean
  /** The runner is on screen and showing its own bar; the shell stands down. */
  ownedByRunner: boolean
}

function readDeadline(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const at = Number(raw)
    return Number.isFinite(at) && at > Date.now() ? at : null
  } catch {
    return null
  }
}

class RestClock {
  private deadline: number | null = readDeadline()
  private ringingUntil: number | null = null
  private runnerMounted = false
  private listeners = new Set<() => void>()
  private ticker: ReturnType<typeof setInterval> | null = null
  private snapshot: RestSnapshot = { secondsLeft: null, ringing: false, ownedByRunner: false }

  constructor() {
    if (typeof document !== 'undefined') {
      // coming back from a locked screen: recompute rather than trust state
      const resync = () => {
        this.deadline = readDeadline()
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

  getSnapshot = (): RestSnapshot => this.snapshot

  private emit() {
    this.listeners.forEach((l) => l())
  }

  private ensureTicking() {
    const needed = this.deadline != null || this.ringingUntil != null
    if (needed && this.ticker == null) {
      this.ticker = setInterval(() => this.refresh(), 250)
    } else if (!needed && this.ticker != null) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  /** Recompute from the clock; fire the alarm exactly once per deadline. */
  private refresh() {
    const now = Date.now()
    if (this.deadline != null && now >= this.deadline) {
      this.deadline = null
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* private mode */
      }
      this.ringingUntil = now + RINGING_MS
      chime.play()
    }
    if (this.ringingUntil != null && now >= this.ringingUntil) this.ringingUntil = null

    const secondsLeft = this.deadline == null ? null : Math.max(0, Math.ceil((this.deadline - now) / 1000))
    const next: RestSnapshot = {
      secondsLeft,
      ringing: this.ringingUntil != null,
      ownedByRunner: this.runnerMounted,
    }
    const changed =
      next.secondsLeft !== this.snapshot.secondsLeft ||
      next.ringing !== this.snapshot.ringing ||
      next.ownedByRunner !== this.snapshot.ownedByRunner
    this.snapshot = next
    this.ensureTicking()
    if (changed) this.emit()
  }

  private write(at: number | null) {
    try {
      if (at == null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, String(at))
    } catch {
      /* private mode — the countdown still works for this page's lifetime */
    }
  }

  start(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const at = Date.now() + seconds * 1000
    this.write(at)
    this.deadline = at
    this.ringingUntil = null
    this.refresh()
  }

  extend(seconds: number) {
    const base = this.deadline ?? Date.now()
    const at = base + seconds * 1000
    this.write(at)
    this.deadline = at
    this.ringingUntil = null
    this.refresh()
  }

  skip() {
    this.write(null)
    this.deadline = null
    this.ringingUntil = null
    this.refresh()
  }

  unlockSound() {
    chime.unlock()
  }

  /** The runner takes over the bar while it is on screen. */
  setRunnerMounted(mounted: boolean) {
    this.runnerMounted = mounted
    this.refresh()
  }
}

export const restClock = new RestClock()

export function useRestClock(): RestSnapshot {
  return useSyncExternalStore(restClock.subscribe, restClock.getSnapshot, restClock.getSnapshot)
}
