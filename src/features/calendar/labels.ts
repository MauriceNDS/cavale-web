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

/** Workout-step chip styling by pace zone (structured description blocks). */
export function zoneChip(zone: string | null): { chip: string; edge: string } {
  const z = zone ?? ''
  if (z.includes('VMA') || z.includes('Test'))
    return { chip: 'bg-rowan-600/15 text-rowan-600 dark:bg-rowan-300/15 dark:text-rowan-300', edge: 'border-l-rowan-600 dark:border-l-rowan-300' }
  if (z.includes('Seuil 30'))
    return { chip: 'bg-clay-500/15 text-clay-500 dark:bg-clay-300/15 dark:text-clay-300', edge: 'border-l-clay-500 dark:border-l-clay-300' }
  if (z.includes('Seuil'))
    return { chip: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300', edge: 'border-l-gold-600 dark:border-l-gold-300' }
  if (z.includes('Tempo') || z.includes('AC') || z.includes('allure course'))
    return { chip: 'bg-teal-600/15 text-teal-600 dark:bg-teal-300/15 dark:text-teal-300', edge: 'border-l-teal-600 dark:border-l-teal-300' }
  if (z.includes('Sprint'))
    return { chip: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300', edge: 'border-l-copper-600 dark:border-l-copper-300' }
  if (z.includes('EF') || z.includes('Récup') || z.includes('Z1') || z.includes('Z2'))
    return { chip: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300', edge: 'border-l-pine-600 dark:border-l-pine-350' }
  return { chip: 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400', edge: 'border-l-moss-300 dark:border-l-moss-700' }
}

/** "30″" under a minute, "20′" / "1h05" above. */
export function formatStepDuration(sec: number | null): string | null {
  if (sec == null) return null
  if (sec < 60) return `${sec}″`
  return formatDuration(Math.round(sec / 60))
}

export const SECTION_LABEL: Record<'WARMUP' | 'MAIN' | 'COOLDOWN', string> = {
  WARMUP: 'Échauffement',
  MAIN: 'Corps de séance',
  COOLDOWN: 'Retour au calme',
}

export function formatDuration(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}
