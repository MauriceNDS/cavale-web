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
