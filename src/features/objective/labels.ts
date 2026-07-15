import i18n from '../../i18n'
import type { ObjectiveIntensity, ObjectiveKind, ObjectiveResponse, ObjectiveType } from './api'

/** Human label for an objective type, in the active UI language. */
export function objectiveTypeLabel(type: ObjectiveType): string {
  return i18n.t(`objective:types.${type}`)
}

export function objectiveKindLabel(kind: ObjectiveKind): string {
  return i18n.t(`objective:kinds.${kind}`)
}

export function objectiveIntensityLabel(intensity: ObjectiveIntensity): string {
  return i18n.t(`objective:intensities.${intensity}`)
}

export const OBJECTIVE_TYPES: ObjectiveType[] = ['RACE', 'RECOVERY', 'FITNESS', 'GENERAL']
export const OBJECTIVE_KINDS: ObjectiveKind[] = ['TRAIL', 'ROAD']
export const OBJECTIVE_INTENSITIES: ObjectiveIntensity[] = ['BALANCE', 'PERFORMANCE']

/** Kind badge: trail leans copper (the trail accent), road the neutral lake. */
export const OBJECTIVE_KIND_BADGE: Record<ObjectiveKind, string> = {
  TRAIL: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  ROAD: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
}

/** Intensity badge: performance in gold (push), balance in calm pine. */
export const OBJECTIVE_INTENSITY_BADGE: Record<ObjectiveIntensity, string> = {
  BALANCE: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  PERFORMANCE: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
}

/** Target pace (sec/km) for a road objective with a target time + distance. */
export function objectivePaceSecPerKm(objective: ObjectiveResponse): number | null {
  if (objective.targetTimeMin == null || objective.distanceKm == null || objective.distanceKm <= 0) {
    return null
  }
  return Math.round((objective.targetTimeMin * 60) / objective.distanceKm)
}

/** Km-effort (km + D+/100) — the trail currency. */
export function objectiveKmEffort(objective: ObjectiveResponse): number | null {
  if (objective.distanceKm == null) return null
  return Math.round(objective.distanceKm + (objective.elevationGainM ?? 0) / 100)
}

/** A pace written the runner's way: "4:30 /km". */
export function formatPaceSecPerKm(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`
}

/** Badge styling per objective type — semantic Massif colors. */
export const OBJECTIVE_TYPE_BADGE: Record<ObjectiveType, string> = {
  RACE: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  RECOVERY: 'bg-clay-500/15 text-clay-500 dark:bg-clay-300/15 dark:text-clay-300',
  FITNESS: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  GENERAL: 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400',
}

/** Race/target times written the runner's way: "8h30", "45 min". */
export function formatTimeMin(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

/** Durations summed from training, in whole hours: "42 h". */
export function formatHours(min: number): string {
  return `${Math.round(min / 60)} h`
}
