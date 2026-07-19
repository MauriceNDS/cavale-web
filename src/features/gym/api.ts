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
export type Equipment = 'BARBELL' | 'DUMBBELL' | 'MACHINE' | 'BODYWEIGHT' | 'BAND' | 'BOX'
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
  templateExerciseId: string
  /** The EFFECTIVE exercise — a swap shows the replacement. */
  exercise: ExerciseResponse
  /** The prescribed exercise when a swap is active, null otherwise. */
  swappedFrom: ExerciseResponse | null
  skipped: boolean
  alternatives: ExerciseResponse[]
  sets: number
  targetReps: number | null
  targetSeconds: number | null
  restSec: number | null
  intensityPct: number | null
  note: string | null
  lastSets: SetLogResponse[]
  recordWeightKg: number | null
}

export interface WorkoutDetailResponse {
  log: WorkoutLogResponse
  blocks: WorkoutBlockResponse[]
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
}

export function logSet(workoutLogId: string, body: LogSetRequest): Promise<SetLogResponse> {
  return api.put<SetLogResponse>(`/api/workouts/${workoutLogId}/sets`, body)
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
