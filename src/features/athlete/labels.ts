/** Race/record times: "3′45″" under the hour, "1h05" and "12h30" above. */
export function formatChrono(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return s > 0 ? `${m}′${String(s).padStart(2, '0')}″` : `${m}′`
}

/** Pace: "5′35″/km". */
export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}′${String(s).padStart(2, '0')}″/km`
}

/** Durations in hours for totals: "42 h". */
export function formatHours(min: number): string {
  return `${Math.round(min / 60)} h`
}

/** "2026-07" → "juil. 26" for chart axes. */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const names = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${names[Number(m) - 1]} ${year.slice(2)}`
}
