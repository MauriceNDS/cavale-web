import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'cavale.rest'

/**
 * The rest countdown, stored as the INSTANT IT ENDS rather than as a
 * number ticking down. A stored deadline survives everything a phone does
 * to a web page — locking the screen, suspending the tab, a refresh, a
 * navigation to another page — because there is nothing to keep running:
 * the remaining time is recomputed from the clock whenever anyone asks.
 *
 * That matters more than it sounds. The previous timer was a number in
 * component state, so it died the moment the screen went dark, which is
 * precisely when a rest timer is supposed to be working.
 */
function readDeadline(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const at = Number(raw)
  return Number.isFinite(at) && at > Date.now() ? at : null
}

/**
 * A short chime, synthesised rather than shipped as an audio file.
 *
 * iOS only lets a page make sound after a real user gesture, and refuses
 * entirely when the ring switch is on silent — so this is a bonus signal,
 * never the only one. The visual alarm is what actually has to land.
 */
class Chime {
  private context: AudioContext | null = null

  /** Call from a tap: the first gesture is what buys the right to play. */
  unlock() {
    if (this.context) return
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext
    if (!Ctor) return
    try {
      this.context = new Ctor()
      void this.context.resume()
    } catch {
      this.context = null
    }
  }

  play() {
    const context = this.context
    if (!context) return
    void context.resume()
    // two short rising notes — audible over gym noise, not alarming
    ;[
      { at: 0, hz: 660 },
      { at: 0.18, hz: 880 },
    ].forEach(({ at, hz }) => {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz
      const start = context.currentTime + at
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain).connect(context.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    })
  }
}

const chime = new Chime()

export interface RestTimer {
  /** Seconds left, or null when no rest is running. */
  secondsLeft: number | null
  /** True for a few seconds after it hits zero — drives the visual alarm. */
  ringing: boolean
  start: (seconds: number) => void
  extend: (seconds: number) => void
  skip: () => void
  /** Call on any tap so the chime is allowed to sound later. */
  unlockSound: () => void
}

/** How long the "go" state stays up before fading back to nothing. */
const RINGING_MS = 8000

export function useRestTimer(): RestTimer {
  const [deadline, setDeadline] = useState<number | null>(() => readDeadline())
  const [now, setNow] = useState(() => Date.now())
  const [ringingUntil, setRingingUntil] = useState<number | null>(null)
  const firedFor = useRef<number | null>(null)

  // one interval for the whole app, only while something is counting
  useEffect(() => {
    if (deadline == null && ringingUntil == null) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline, ringingUntil])

  // coming back from a locked screen: recompute rather than trust state
  useEffect(() => {
    const resync = () => {
      setNow(Date.now())
      setDeadline(readDeadline())
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  const remaining = deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))

  useEffect(() => {
    if (deadline == null || remaining == null || remaining > 0) return
    if (firedFor.current === deadline) return
    firedFor.current = deadline
    chime.play()
    setRingingUntil(Date.now() + RINGING_MS)
    localStorage.removeItem(STORAGE_KEY)
    setDeadline(null)
  }, [deadline, remaining])

  useEffect(() => {
    if (ringingUntil != null && now >= ringingUntil) setRingingUntil(null)
  }, [now, ringingUntil])

  const start = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const at = Date.now() + seconds * 1000
    localStorage.setItem(STORAGE_KEY, String(at))
    firedFor.current = null
    setRingingUntil(null)
    setDeadline(at)
    setNow(Date.now())
  }, [])

  const extend = useCallback((seconds: number) => {
    const base = readDeadline() ?? Date.now()
    const at = base + seconds * 1000
    localStorage.setItem(STORAGE_KEY, String(at))
    firedFor.current = null
    setRingingUntil(null)
    setDeadline(at)
  }, [])

  const skip = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    firedFor.current = null
    setDeadline(null)
    setRingingUntil(null)
  }, [])

  return {
    secondsLeft: remaining,
    ringing: ringingUntil != null,
    start,
    extend,
    skip,
    unlockSound: () => chime.unlock(),
  }
}

/**
 * Keep the screen lit for the duration of a workout.
 *
 * On iOS the visual alarm IS the alarm — there is no vibration API and
 * sound dies on the silent switch — so a dark screen would mean no signal
 * at all. The lock is dropped the moment the workout ends, and browsers
 * drop it themselves when the tab goes to the background, so it has to be
 * re-taken on the way back.
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
