import i18n from '../../i18n'
import type { ObjectiveType } from './api'

/** Human label for an objective type, in the active UI language. */
export function objectiveTypeLabel(type: ObjectiveType): string {
  return i18n.t(`objective:types.${type}`)
}

export const OBJECTIVE_TYPES: ObjectiveType[] = ['RACE', 'RECOVERY', 'FITNESS', 'GENERAL']

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
