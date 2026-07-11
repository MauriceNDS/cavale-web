import { api } from '../../lib/api'
import type { PlanResponse, WeekType } from '../calendar/api'

export type ObjectiveRole = 'MAIN' | 'SECONDARY'
export type ObjectiveType = 'RACE' | 'RECOVERY' | 'FITNESS' | 'GENERAL'

export interface ObjectiveResponse {
  id: string
  planId: string
  role: ObjectiveRole
  type: ObjectiveType
  name: string
  date: string | null
  distanceKm: number | null
  elevationGainM: number | null
  targetTimeMin: number | null
  resultTimeMin: number | null
  location: string | null
  notes: string | null
}

export interface ProgressTotals {
  sessionsPlanned: number
  sessionsDone: number
  sessionsSkipped: number
  sessionsDuePast: number
  sessionsDonePast: number
  actualVolumeKm: number
  actualElevationM: number
  actualDurationMin: number
  plannedVolumeKmToDate: number
  plannedElevationMToDate: number
  targetVolumeKm: number
  targetElevationM: number
}

export interface WeekProgress {
  weekId: string
  weekNumber: number
  startDate: string
  weekType: WeekType
  phase: string | null
  current: boolean
  targetVolumeKm: number | null
  targetElevationM: number | null
  targetLoadUa: number | null
  actualVolumeKm: number
  actualElevationM: number
  actualDurationMin: number
  sessionsPlanned: number
  sessionsDone: number
  sessionsSkipped: number
}

export interface PlanProgressResponse {
  plan: PlanResponse
  mainObjective: ObjectiveResponse | null
  secondaryObjectives: ObjectiveResponse[]
  totalWeeks: number
  currentWeekNumber: number | null
  daysToObjective: number
  totals: ProgressTotals
  weeks: WeekProgress[]
}

export interface ObjectivePayload {
  type: ObjectiveType
  name: string
  date?: string | null
  distanceKm?: number | null
  elevationGainM?: number | null
  targetTimeMin?: number | null
  location?: string | null
  notes?: string | null
}

export interface UpdateObjectivePayload extends ObjectivePayload {
  resultTimeMin?: number | null
}

export function fetchProgress(planId: string): Promise<PlanProgressResponse> {
  return api.get<PlanProgressResponse>(`/api/plans/${planId}/progress`)
}

export function fetchObjectives(planId: string): Promise<ObjectiveResponse[]> {
  return api.get<ObjectiveResponse[]>(`/api/plans/${planId}/objectives`)
}

export function createObjective(planId: string, body: ObjectivePayload): Promise<ObjectiveResponse> {
  return api.post<ObjectiveResponse>(`/api/plans/${planId}/objectives`, body)
}

export function updateObjective(objectiveId: string, body: UpdateObjectivePayload): Promise<ObjectiveResponse> {
  return api.put<ObjectiveResponse>(`/api/objectives/${objectiveId}`, body)
}

export function deleteObjective(objectiveId: string): Promise<void> {
  return api.delete(`/api/objectives/${objectiveId}`)
}
