/**
 * A short chime, synthesised rather than shipped as an audio file.
 *
 * iOS only lets a page make sound after a real user gesture, and refuses
 * entirely when the ring switch is on silent — so this is a bonus signal,
 * never the only one. The visual alarm is what actually has to land.
 *
 * One shared instance for the whole app: the audio context is unlocked by the
 * first tap the athlete makes, and every timer that wants to ring afterwards
 * — rest between sets, a plank hold — rides that same permission. A second
 * instance would start locked and stay silent until it happened to be tapped.
 */
class Chime {
  private context: AudioContext | null = null

  /** Call from a tap: the first gesture is what buys the right to play. */
  unlock() {
    if (this.context) return
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.context = new Ctor()
      void this.context.resume()
    } catch {
      this.context = null
    }
  }

  /** @param notes rising pairs of [delay seconds, frequency] */
  play(notes: { at: number; hz: number }[] = DEFAULT_NOTES) {
    const context = this.context
    if (!context) return
    void context.resume()
    notes.forEach(({ at, hz }) => {
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

/** Two short rising notes — audible over gym noise, not alarming. */
const DEFAULT_NOTES = [
  { at: 0, hz: 660 },
  { at: 0.18, hz: 880 },
]

/** Three notes, for the end of a held effort — distinct from "rest is over". */
export const HOLD_DONE_NOTES = [
  { at: 0, hz: 880 },
  { at: 0.16, hz: 880 },
  { at: 0.32, hz: 1175 },
]

export const chime = new Chime()
