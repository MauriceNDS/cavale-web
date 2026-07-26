import i18n from '../../i18n'
import type { Discipline, SessionResponse, WeekType } from './api'

export function weekTypeLabel(type: WeekType): string {
  return i18n.t(`calendar:weekType.${type}`)
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

/** Left-edge accent per week type (season list rows) — mirrors WEEK_TYPE_BADGE. */
export const WEEK_TYPE_EDGE: Record<WeekType, string> = {
  RECOVERY: 'border-l-pine-600 dark:border-l-pine-350',
  TRANSITION: 'border-l-moss-400 dark:border-l-moss-500',
  BUILD: 'border-l-moss-400 dark:border-l-moss-500',
  DELOAD: 'border-l-pine-600 dark:border-l-pine-350',
  SHOCK: 'border-l-wine-700 dark:border-l-wine-300',
  TAPER: 'border-l-lake-600 dark:border-l-lake-300',
  RACE: 'border-l-copper-600 dark:border-l-copper-300',
}

export function disciplineLabel(d: Discipline): string {
  return i18n.t(`calendar:discipline.${d}`)
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
  | 'HIKE'
  | 'REST'

export function trainingKind(session: SessionResponse): TrainingKind {
  if (session.discipline === 'GYM') return 'GYM'
  if (session.discipline === 'REST') return 'REST'
  if (session.discipline === 'CROSS') return 'CROSS'
  if (session.discipline === 'HIKE') return 'HIKE'

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

export function kindLabel(kind: TrainingKind): string {
  return i18n.t(`calendar:kind.${kind}`)
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
  HIKE: 'border-l-moss-700 dark:border-l-moss-300',
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
  HIKE: 'bg-moss-700 dark:bg-moss-300',
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
  'HIKE',
]

import type { Allure, PaceContextResponse, PerceivedEffort, Terrain, WorkoutNode } from './api'

export function effortLabel(e: PerceivedEffort): string {
  return i18n.t(`calendar:effort.${e}`)
}

export const EFFORTS: PerceivedEffort[] = [
  'TROP_FACILE',
  'FACILE',
  'COMME_PREVU',
  'DIFFICILE',
  'TROP_DIFFICILE',
]

/** Total execution time of a workout tree, in seconds. */
export function totalWorkoutSeconds(nodes: WorkoutNode[]): number {
  let total = 0
  for (const node of nodes) {
    if (node.type === 'repeat') {
      total += (node.count ?? 1) * totalWorkoutSeconds(node.children ?? [])
    } else if (node.seconds != null) {
      total += node.seconds
    }
  }
  return total
}

/** Strips a trailing duration token from a title ("Footing EF 25–30′" → "Footing EF"). */
export function cleanTitle(title: string): string {
  return title
    .replace(
      /[\s—·:-]*(?:\d+\s*[-–]\s*)?(?:\d+h\d{0,2}|\d+\s*(?:′|'|min\b)|\d+\s*(?:″|"|sec\b))\s*$/u,
      '',
    )
    .trim()
}

/** Display names — a block's identity is always its allure. */
export function allureLabel(a: Allure): string {
  return i18n.t(`calendar:allure.${a}`)
}

export const ALLURES: Allure[] = ['LENTE', 'EF', 'COURSE', 'SEUIL60', 'SEUIL30', 'VMA', 'SPRINT']

export function terrainLabel(t: Terrain): string {
  return i18n.t(`calendar:terrain.${t}`)
}

/** Block styling by allure. */
export function allureStyle(allure: Allure | null): { title: string; edge: string } {
  switch (allure) {
    case 'VMA':
      return { title: 'text-rowan-600 dark:text-rowan-300', edge: 'border-l-rowan-600 dark:border-l-rowan-300' }
    case 'SEUIL30':
      return { title: 'text-clay-500 dark:text-clay-300', edge: 'border-l-clay-500 dark:border-l-clay-300' }
    case 'SEUIL60':
      return { title: 'text-gold-600 dark:text-gold-300', edge: 'border-l-gold-600 dark:border-l-gold-300' }
    case 'COURSE':
      return { title: 'text-teal-600 dark:text-teal-300', edge: 'border-l-teal-600 dark:border-l-teal-300' }
    case 'SPRINT':
      return { title: 'text-copper-600 dark:text-copper-300', edge: 'border-l-copper-600 dark:border-l-copper-300' }
    case 'EF':
      return { title: 'text-pine-700 dark:text-pine-300', edge: 'border-l-pine-600 dark:border-l-pine-350' }
    case 'LENTE':
    default:
      return { title: 'text-moss-500 dark:text-moss-400', edge: 'border-l-moss-300 dark:border-l-moss-700' }
  }
}

/* ── Derived pace bands (road seasons only) ────────────────────────── */

export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const round5 = (sec: number) => Math.round(sec / 5) * 5

function paceBandLabel(secPerKm: number, pct: number): string {
  return `${formatPace(round5(secPerKm * (1 - pct)))}–${formatPace(round5(secPerKm * (1 + pct)))} /km`
}

/**
 * The pace band an allure should be run in, derived from the athlete's own
 * model at DISPLAY time (so the same plan speeds up as fitness improves).
 * Race-pace blocks anchor to the objective's goal pace when one is set.
 * Null outside a road season — trail thinks in km-effort, not min/km.
 */
export function allurePaceBand(
  pace: PaceContextResponse | null | undefined,
  allure: Allure | null,
): { label: string; goal: boolean } | null {
  if (!pace?.roadContext || !allure) return null
  if (allure === 'COURSE' && pace.goalPaceSecPerKm) {
    return { label: paceBandLabel(pace.goalPaceSecPerKm, 0.03), goal: true }
  }
  const sec = pace.flatSecPerKm[allure]
  if (!sec) return null
  // wide comfort band for easy running, tighter for quality work
  return { label: paceBandLabel(sec, allure === 'EF' || allure === 'LENTE' ? 0.06 : 0.04), goal: false }
}

/** Session zone label → the allure whose pace band applies. */
export function zoneAllure(zone: string | null): Allure | null {
  if (!zone) return null
  if (zone.includes('VMA') || zone.includes('Test')) return 'VMA'
  if (zone.includes('Seuil 30')) return 'SEUIL30'
  if (zone.includes('Seuil')) return 'SEUIL60'
  if (zone.includes('Tempo') || zone.includes('AC') || zone.includes('Course')) return 'COURSE'
  if (zone.includes('Sprint')) return 'SPRINT'
  if (zone.includes('Récup')) return 'LENTE'
  if (zone.includes('EF') || zone.includes('SL')) return 'EF'
  return null
}

/** Times written with letters: "10 sec", "3 min", "45 min", "1h30". */
export function formatSeconds(sec: number | null): string | null {
  if (sec == null) return null
  if (sec < 60) return `${sec} sec`
  const h = Math.floor(sec / 3600)
  const min = Math.floor((sec % 3600) / 60)
  const rest = sec % 60
  if (h > 0) return min > 0 ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`
  return rest > 0 ? `${min} min ${rest} sec` : `${min} min`
}

export function formatDuration(min: number | null): string | null {
  if (min == null) return null
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}
