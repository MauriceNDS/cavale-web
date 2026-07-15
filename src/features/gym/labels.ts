import i18n from '../../i18n'
import type { Equipment, ExerciseCategory, ExerciseMeasure, Muscle } from './api'

export function categoryLabel(category: ExerciseCategory): string {
  return i18n.t(`gym:labels.category.${category}`)
}

/** Category color coding — one hue per training family, both modes. */
export const CATEGORY_BADGE: Record<ExerciseCategory, string> = {
  FORCE: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  PLIOMETRIE: 'bg-rowan-600/15 text-rowan-600 dark:bg-rowan-300/15 dark:text-rowan-300',
  GAINAGE: 'bg-teal-600/15 text-teal-600 dark:bg-teal-300/15 dark:text-teal-300',
  MOBILITE: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
}

/** Left-edge accent per category on cards, calendar-style. */
export const CATEGORY_EDGE: Record<ExerciseCategory, string> = {
  FORCE: 'border-l-copper-600 dark:border-l-copper-300',
  PLIOMETRIE: 'border-l-rowan-600 dark:border-l-rowan-300',
  GAINAGE: 'border-l-teal-600 dark:border-l-teal-300',
  MOBILITE: 'border-l-lake-600 dark:border-l-lake-300',
}

export const CATEGORIES: ExerciseCategory[] = ['FORCE', 'PLIOMETRIE', 'GAINAGE', 'MOBILITE']

export function muscleLabel(muscle: Muscle): string {
  return i18n.t(`gym:labels.muscle.${muscle}`)
}

export const MUSCLES: Muscle[] = [
  'QUADRICEPS',
  'ISCHIOS',
  'FESSIERS',
  'MOLLETS',
  'TIBIAUX',
  'ADDUCTEURS',
  'CORE',
  'DOS',
  'EPAULES',
  'BRAS',
  'PIEDS_CHEVILLES',
]

export function equipmentLabel(equipment: Equipment): string {
  return i18n.t(`gym:labels.equipment.${equipment}`)
}

export const EQUIPMENTS: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'BODYWEIGHT', 'BAND', 'BOX']

export function measureLabel(measure: ExerciseMeasure): string {
  return i18n.t(`gym:labels.measure.${measure}`)
}

export const MEASURES: ExerciseMeasure[] = ['WEIGHT_REPS', 'BODYWEIGHT_REPS', 'SECONDS']

/** "3 × 6" or "3 × 45 sec" — the prescription in one glance. */
export function formatPrescription(sets: number, reps: number | null, seconds: number | null): string {
  if (seconds != null) return i18n.t('gym:labels.prescriptionSeconds', { sets, seconds })
  return `${sets} × ${reps ?? '?'}`
}

export function formatRest(restSec: number | null): string | null {
  if (restSec == null) return null
  if (restSec < 60) return i18n.t('gym:labels.restSec', { sec: restSec })
  const min = Math.floor(restSec / 60)
  const rest = restSec % 60
  return rest === 0
    ? i18n.t('gym:labels.restMin', { min })
    : i18n.t('gym:labels.restMinSec', { min, sec: rest })
}
