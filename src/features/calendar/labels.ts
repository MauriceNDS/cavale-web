import type { Discipline, SessionResponse, WeekType } from './api'

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
  SHOCK: 'bg-wine-700/15 text-wine-700 dark:bg-wine-300/15 dark:text-wine-300',
  TAPER: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  RACE: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  RUN: 'Course',
  GYM: 'Renfo',
  REST: 'Repos',
  CROSS: 'Croisé',
}

/* ── Training-kind classification (drives calendar colors) ─────────── */

export type TrainingKind =
  | 'CHOC'
  | 'SL'
  | 'VMA'
  | 'SEUIL30'
  | 'SEUIL60'
  | 'TEMPO'
  | 'EF'
  | 'GYM'
  | 'CROSS'
  | 'REST'

export function trainingKind(session: SessionResponse): TrainingKind {
  if (session.discipline === 'GYM') return 'GYM'
  if (session.discipline === 'REST') return 'REST'
  if (session.discipline === 'CROSS') return 'CROSS'

  const title = session.title.toUpperCase()
  if (title.includes('CHOC')) return 'CHOC'
  if (/(^|[^A-Z])SL([^A-Z]|$)/.test(title) || title.includes('SORTIE LONGUE')) return 'SL'

  const zone = session.zone ?? ''
  if (zone.includes('VMA') || zone.includes('Test')) return 'VMA'
  if (zone.includes('Seuil 30')) return 'SEUIL30'
  if (zone.includes('Seuil 60') || zone.includes('Seuil')) return 'SEUIL60'
  if (zone.includes('Tempo') || zone.includes('AC')) return 'TEMPO'
  return 'EF'
}

export const KIND_LABEL: Record<TrainingKind, string> = {
  CHOC: 'Bloc choc',
  SL: 'Sortie longue',
  VMA: 'VMA / VO2',
  SEUIL30: 'Seuil 30',
  SEUIL60: 'Seuil 60',
  TEMPO: 'Tempo / AC',
  EF: 'EF / Récup',
  GYM: 'Renfo',
  CROSS: 'Croisé',
  REST: 'Repos',
}

/** Left-edge accent per training kind on session cards (week view). */
export const KIND_EDGE: Record<TrainingKind, string> = {
  CHOC: 'border-l-wine-700 dark:border-l-wine-300',
  SL: 'border-l-lake-600 dark:border-l-lake-300',
  VMA: 'border-l-rowan-600 dark:border-l-rowan-300',
  SEUIL30: 'border-l-clay-500 dark:border-l-clay-300',
  SEUIL60: 'border-l-gold-600 dark:border-l-gold-300',
  TEMPO: 'border-l-teal-600 dark:border-l-teal-300',
  EF: 'border-l-pine-600 dark:border-l-pine-350',
  GYM: 'border-l-copper-600 dark:border-l-copper-300',
  CROSS: 'border-l-moss-400 dark:border-l-moss-500',
  REST: 'border-l-moss-300 dark:border-l-moss-700',
}

/** Dot color per training kind (month view). */
export const KIND_DOT: Record<TrainingKind, string> = {
  CHOC: 'bg-wine-700 dark:bg-wine-300',
  SL: 'bg-lake-600 dark:bg-lake-300',
  VMA: 'bg-rowan-600 dark:bg-rowan-300',
  SEUIL30: 'bg-clay-500 dark:bg-clay-300',
  SEUIL60: 'bg-gold-600 dark:bg-gold-300',
  TEMPO: 'bg-teal-600 dark:bg-teal-300',
  EF: 'bg-pine-600 dark:bg-pine-350',
  GYM: 'bg-copper-600 dark:bg-copper-300',
  CROSS: 'bg-moss-400 dark:bg-moss-500',
  REST: 'bg-moss-300 dark:bg-moss-700',
}

/** Legend order for the month view. */
export const KIND_LEGEND: TrainingKind[] = [
  'EF',
  'TEMPO',
  'SEUIL60',
  'SEUIL30',
  'VMA',
  'SL',
  'CHOC',
  'GYM',
  'CROSS',
]

export function formatDuration(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}
