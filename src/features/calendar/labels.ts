import type { Discipline, WeekType } from './api'

export const WEEK_TYPE_LABEL: Record<WeekType, string> = {
  RECOVERY: 'Récupération',
  TRANSITION: 'Transition',
  BUILD: 'Développement',
  DELOAD: 'Décharge',
  SHOCK: 'Bloc choc',
  TAPER: 'Affûtage',
  RACE: 'Course',
}

/** Badge styling per week type — semantic colors from the Massif system. */
export const WEEK_TYPE_BADGE: Record<WeekType, string> = {
  RECOVERY: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  TRANSITION: 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400',
  BUILD: 'bg-moss-100 text-ink dark:bg-moss-800 dark:text-linen',
  DELOAD: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  SHOCK: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
  TAPER: 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400',
  RACE: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  RUN: 'Course',
  GYM: 'Renfo',
  REST: 'Repos',
  CROSS: 'Croisé',
}

/** Left-edge accent per discipline on session cards. */
export const DISCIPLINE_EDGE: Record<Discipline, string> = {
  RUN: 'border-l-pine-600 dark:border-l-pine-350',
  GYM: 'border-l-copper-600 dark:border-l-copper-300',
  REST: 'border-l-moss-300 dark:border-l-moss-700',
  CROSS: 'border-l-moss-400 dark:border-l-moss-500',
}

export const DISCIPLINE_DOT: Record<Discipline, string> = {
  RUN: 'bg-pine-600 dark:bg-pine-350',
  GYM: 'bg-copper-600 dark:bg-copper-300',
  REST: 'bg-moss-300 dark:bg-moss-700',
  CROSS: 'bg-moss-400 dark:bg-moss-500',
}

export function formatDuration(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}
