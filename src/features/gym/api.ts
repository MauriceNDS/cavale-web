import { api } from '../../lib/api'

export type ExerciseCategory = 'FORCE' | 'PLIOMETRIE' | 'GAINAGE' | 'MOBILITE'
export type Muscle =
  | 'QUADRICEPS'
  | 'ISCHIOS'
  | 'FESSIERS'
  | 'MOLLETS'
  | 'TIBIAUX'
  | 'ADDUCTEURS'
  | 'CORE'
  | 'DOS'
  | 'EPAULES'
  | 'BRAS'
  | 'PIEDS_CHEVILLES'
export type Equipment =
  | 'BARBELL'
  | 'DUMBBELL'
  | 'MACHINE'
  | 'CABLE'
  | 'SMITH'
  | 'BODYWEIGHT'
  | 'BAND'
  | 'BOX'
export type ExerciseMeasure = 'WEIGHT_REPS' | 'BODYWEIGHT_REPS' | 'SECONDS'

export interface ExerciseResponse {
  id: string
  name: string
  category: ExerciseCategory
  equipment: Equipment
  measure: ExerciseMeasure
  description: string | null
  resourceUrl: string | null
  runningBenefit: string | null
  muscles: Muscle[]
  /** As set on the exercise — null means "whatever the equipment does". */
  incrementKg: number | null
  /** The step actually applied, equipment default resolved. */
  effectiveIncrementKg: number
  referenceWeightKg: number | null
  derivedFromId: string | null
  derivedFromName: string | null
  archived: boolean
}

export interface ExerciseRequest {
  name: string
  category: ExerciseCategory
  equipment: Equipment
  measure: ExerciseMeasure
  description?: string
  resourceUrl?: string
  runningBenefit?: string
  muscles: Muscle[]
  incrementKg?: number | null
  referenceWeightKg?: number | null
  derivedFromId?: string
  archived?: boolean
}

export function fetchExercises(): Promise<ExerciseResponse[]> {
  return api.get<ExerciseResponse[]>('/api/exercises')
}

export function createExercise(body: ExerciseRequest): Promise<ExerciseResponse> {
  return api.post<ExerciseResponse>('/api/exercises', body)
}

export function updateExercise(id: string, body: ExerciseRequest): Promise<ExerciseResponse> {
  return api.put<ExerciseResponse>(`/api/exercises/${id}`, body)
}

export function deleteExercise(id: string): Promise<void> {
  return api.delete(`/api/exercises/${id}`)
}

/* ── Templates ─────────────────────────────────────────────────────── */

export interface VariantSummary {
  id: string
  label: string
  note: string | null
  exerciseCount: number
}

export interface TemplateResponse {
  id: string
  name: string
  goal: string | null
  archived: boolean
  variants: VariantSummary[]
}

export interface AlternativeResponse {
  id: string
  exercise: ExerciseResponse
}

export interface TemplateExerciseResponse {
  id: string
  position: number
  exercise: ExerciseResponse
  sets: number
  reps: number | null
  seconds: number | null
  restSec: number | null
  intensityPct: number | null
  note: string | null
  /** Superset this prescription belongs to — shared with its neighbours. */
  groupKey: string | null
  alternatives: AlternativeResponse[]
}

export interface VariantDetailResponse {
  id: string
  templateId: string
  templateName: string
  label: string
  note: string | null
  exercises: TemplateExerciseResponse[]
}

export interface TemplateExerciseRequest {
  exerciseId: string
  sets: number
  reps?: number
  seconds?: number
  restSec?: number
  intensityPct?: number
  note?: string
  groupKey?: string | null
}

export function fetchTemplates(): Promise<TemplateResponse[]> {
  return api.get<TemplateResponse[]>('/api/gym/templates')
}

export function fetchTemplate(templateId: string): Promise<TemplateResponse> {
  return api.get<TemplateResponse>(`/api/gym/templates/${templateId}`)
}

export function createTemplate(body: { name: string; goal?: string }): Promise<TemplateResponse> {
  return api.post<TemplateResponse>('/api/gym/templates', body)
}

export function updateTemplate(
  templateId: string,
  body: { name: string; goal?: string; archived?: boolean },
): Promise<TemplateResponse> {
  return api.patch<TemplateResponse>(`/api/gym/templates/${templateId}`, body)
}

export function deleteTemplate(templateId: string): Promise<void> {
  return api.delete(`/api/gym/templates/${templateId}`)
}

export function fetchVariant(variantId: string): Promise<VariantDetailResponse> {
  return api.get<VariantDetailResponse>(`/api/gym/variants/${variantId}`)
}

export function addVariant(
  templateId: string,
  body: { label: string; note?: string },
): Promise<VariantSummary> {
  return api.post<VariantSummary>(`/api/gym/templates/${templateId}/variants`, body)
}

export function copyVariant(
  variantId: string,
  body: { label: string; note?: string },
): Promise<VariantSummary> {
  return api.post<VariantSummary>(`/api/gym/variants/${variantId}/copy`, body)
}

/**
 * Rewrite which prescriptions are chained into supersets — the WHOLE variant
 * at once. Members of a group must be consecutive; a key left with a single
 * member is dropped server-side. One group holding everything is a circuit.
 */
export function assignGroups(
  variantId: string,
  assignments: { templateExerciseId: string; groupKey: string | null }[],
): Promise<TemplateExerciseResponse[]> {
  return api.put<TemplateExerciseResponse[]>(`/api/gym/variants/${variantId}/groups`, {
    assignments,
  })
}

export function deleteVariant(variantId: string): Promise<void> {
  return api.delete(`/api/gym/variants/${variantId}`)
}

export function addTemplateExercise(
  variantId: string,
  body: TemplateExerciseRequest,
): Promise<TemplateExerciseResponse> {
  return api.post<TemplateExerciseResponse>(`/api/gym/variants/${variantId}/exercises`, body)
}

export function updateTemplateExercise(
  templateExerciseId: string,
  body: TemplateExerciseRequest,
): Promise<TemplateExerciseResponse> {
  return api.patch<TemplateExerciseResponse>(`/api/gym/template-exercises/${templateExerciseId}`, body)
}

export function removeTemplateExercise(templateExerciseId: string): Promise<void> {
  return api.delete(`/api/gym/template-exercises/${templateExerciseId}`)
}

export function reorderExercises(variantId: string, orderedIds: string[]): Promise<TemplateExerciseResponse[]> {
  return api.put<TemplateExerciseResponse[]>(`/api/gym/variants/${variantId}/exercises/order`, {
    orderedIds,
  })
}

export function addAlternative(
  templateExerciseId: string,
  exerciseId: string,
): Promise<AlternativeResponse> {
  return api.post<AlternativeResponse>(
    `/api/gym/template-exercises/${templateExerciseId}/alternatives`,
    { exerciseId },
  )
}

export function removeAlternative(alternativeId: string): Promise<void> {
  return api.delete(`/api/gym/alternatives/${alternativeId}`)
}

/* ── Live workouts ─────────────────────────────────────────────────── */

export type WorkoutStatus = 'IN_PROGRESS' | 'FINISHED'
export type PerceivedEffort = 'TROP_FACILE' | 'FACILE' | 'COMME_PREVU' | 'DIFFICILE' | 'TROP_DIFFICILE'

export interface SetLogResponse {
  id: string
  exerciseId: string
  exerciseName: string
  position: number
  setNumber: number
  reps: number | null
  weightKg: number | null
  seconds: number | null
  /** An approach set — kept out of every statistic. */
  warmup: boolean
  /** Reps left in reserve, 0–4 — asked during the rest that follows the set. */
  rir: number | null
}

export interface WorkoutLogResponse {
  id: string
  status: WorkoutStatus
  startedAt: string
  durationMin: number | null
  templateName: string | null
  sessionId: string | null
  templateVariantId: string | null
  perceivedEffort: PerceivedEffort | null
  painFlag: boolean
  comment: string | null
  sets: SetLogResponse[]
}

export interface WorkoutBlockResponse {
  /** Programmed block — null for a mid-workout addition. */
  templateExerciseId: string | null
  /** Mid-workout addition — null for a programmed block. */
  extraBlockId: string | null
  /** The EFFECTIVE exercise — a swap shows the replacement. */
  exercise: ExerciseResponse
  /** The prescribed exercise when a swap is active, null otherwise. */
  swappedFrom: ExerciseResponse | null
  skipped: boolean
  /** Alternatives declared on the template block. */
  alternatives: ExerciseResponse[]
  /** Ranked same-category / same-muscles candidates computed by the API. */
  suggestedAlternatives: ExerciseResponse[]
  /** EFFECTIVE set count (live adjustment applied; loop count in a circuit). */
  sets: number
  /** What the template prescribes — differs from sets when adjusted live. */
  prescribedSets: number
  targetReps: number | null
  targetSeconds: number | null
  restSec: number | null
  intensityPct: number | null
  note: string | null
  /** Superset this block belongs to — shared with its neighbours. */
  groupKey: string | null
  lastSets: SetLogResponse[]
  recordWeightKg: number | null
}

export interface WorkoutDetailResponse {
  log: WorkoutLogResponse
  blocks: WorkoutBlockResponse[]
  /**
   * DERIVED from the groups: set only when one group holds every block, in
   * which case loops is the longest member's set count. Goes away with the
   * rewritten runner, which reads groupKey directly.
   */
  circuitLoops: number | null
  circuitRestSec: number | null
}

export function startWorkout(body: {
  sessionId?: string
  templateVariantId?: string
}): Promise<WorkoutDetailResponse> {
  return api.post<WorkoutDetailResponse>('/api/workouts', body)
}

/** The workout in progress — null when none (204). */
export async function fetchActiveWorkout(): Promise<WorkoutDetailResponse | null> {
  const detail = await api.get<WorkoutDetailResponse | undefined>('/api/workouts/active')
  return detail ?? null
}

export function fetchWorkout(workoutLogId: string): Promise<WorkoutDetailResponse> {
  return api.get<WorkoutDetailResponse>(`/api/workouts/${workoutLogId}`)
}

export interface LogSetRequest {
  exerciseId: string
  position: number
  setNumber: number
  reps?: number
  weightKg?: number
  seconds?: number
  /** Absent means a working set. */
  warmup?: boolean
  rir?: number
}

export function logSet(workoutLogId: string, body: LogSetRequest): Promise<SetLogResponse> {
  return api.put<SetLogResponse>(`/api/workouts/${workoutLogId}/sets`, body)
}

/** Answer "how many reps were left?" after the fact, from the rest countdown. */
export function rateSet(setLogId: string, rir: number | null): Promise<SetLogResponse> {
  return api.patch<SetLogResponse>(`/api/workouts/sets/${setLogId}/rating`, { rir })
}

/** Un-tick a set logged by mistake. */
export function deleteSet(setLogId: string): Promise<void> {
  return api.delete(`/api/workouts/sets/${setLogId}`)
}

export interface AddExtraBlockRequest {
  exerciseId: string
  sets: number
  reps?: number
  seconds?: number
  restSec?: number
  note?: string
}

/** Add an exercise to this workout only — the program is untouched. */
export function addExtraBlock(
  workoutLogId: string,
  body: AddExtraBlockRequest,
): Promise<WorkoutBlockResponse> {
  return api.post<WorkoutBlockResponse>(`/api/workouts/${workoutLogId}/extra-blocks`, body)
}

/** Remove a mid-workout addition — its logged sets go with it. */
export function removeExtraBlock(workoutLogId: string, extraBlockId: string): Promise<void> {
  return api.delete(`/api/workouts/${workoutLogId}/extra-blocks/${extraBlockId}`)
}

export function finishWorkout(
  workoutLogId: string,
  body: { durationMin?: number; perceivedEffort?: PerceivedEffort; painFlag?: boolean; comment?: string },
): Promise<WorkoutLogResponse> {
  return api.post<WorkoutLogResponse>(`/api/workouts/${workoutLogId}/finish`, body)
}

export function abandonWorkout(workoutLogId: string): Promise<void> {
  return api.delete(`/api/workouts/${workoutLogId}`)
}

/** Machine taken: swap a block to an alternative (or back to the prescribed one). */
export function swapWorkoutBlock(
  workoutLogId: string,
  templateExerciseId: string,
  exerciseId: string,
): Promise<WorkoutBlockResponse> {
  return api.put<WorkoutBlockResponse>(
    `/api/workouts/${workoutLogId}/blocks/${templateExerciseId}/exercise`,
    { exerciseId },
  )
}

/** Adjust a block's set count for this workout only — down to 0. */
export function adjustBlockSets(
  workoutLogId: string,
  templateExerciseId: string,
  sets: number,
): Promise<WorkoutBlockResponse> {
  return api.put<WorkoutBlockResponse>(
    `/api/workouts/${workoutLogId}/blocks/${templateExerciseId}/sets`,
    { sets },
  )
}

/** Same adjustment for a mid-workout addition. */
export function adjustExtraBlockSets(
  workoutLogId: string,
  extraBlockId: string,
  sets: number,
): Promise<WorkoutBlockResponse> {
  return api.put<WorkoutBlockResponse>(
    `/api/workouts/${workoutLogId}/extra-blocks/${extraBlockId}/sets`,
    { sets },
  )
}

/** No time left: drop a block from this workout (undoable). */
export function skipWorkoutBlock(
  workoutLogId: string,
  templateExerciseId: string,
): Promise<WorkoutBlockResponse> {
  return api.post<WorkoutBlockResponse>(
    `/api/workouts/${workoutLogId}/blocks/${templateExerciseId}/skip`,
    {},
  )
}

export function restoreWorkoutBlock(
  workoutLogId: string,
  templateExerciseId: string,
): Promise<WorkoutBlockResponse> {
  return api.post<WorkoutBlockResponse>(
    `/api/workouts/${workoutLogId}/blocks/${templateExerciseId}/restore`,
    {},
  )
}

/* ── Stats ─────────────────────────────────────────────────────────── */

export interface TrendPoint {
  date: string
  bestWeightKg: number
  estOneRmKg: number
}

export interface ExerciseTrend {
  exerciseId: string
  name: string
  category: ExerciseCategory
  points: TrendPoint[]
}

export interface WeekTonnage {
  weekStart: string
  tonnageKg: number
  sets: number
  workouts: number
}

export interface MuscleVolume {
  muscle: Muscle
  sets: number
  tonnageKg: number
}

export interface PrEntry {
  exerciseId: string
  exerciseName: string
  reps: number
  weightKg: number
  previousKg: number | null
  date: string
}

export interface WeekAdherence {
  weekStart: string
  plannedGym: number
  doneGym: number
}

export interface GymStatsResponse {
  oneRmTrends: ExerciseTrend[]
  weeklyTonnage: WeekTonnage[]
  muscleVolume: MuscleVolume[]
  prWall: PrEntry[]
  adherence: WeekAdherence[]
}

export function fetchGymStats(): Promise<GymStatsResponse> {
  return api.get<GymStatsResponse>('/api/gym/stats')
}
