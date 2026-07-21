import { api } from '../../lib/api'
import type { PlanResponse, WeekType } from '../calendar/api'

export type ObjectiveRole = 'MAIN' | 'SECONDARY'
export type ObjectiveType = 'RACE' | 'RECOVERY' | 'FITNESS' | 'GENERAL'
export type ObjectiveKind = 'ROAD' | 'TRAIL'
export type ObjectiveIntensity = 'BALANCE' | 'PERFORMANCE'

export interface ObjectiveResponse {
  id: string
  planId: string
  role: ObjectiveRole
  type: ObjectiveType
  kind: ObjectiveKind
  intensity: ObjectiveIntensity
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
  /** Km the prescribed session times should actually produce (personal pace model). */
  estimatedVolumeKm: number | null
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
  kind: ObjectiveKind
  intensity: ObjectiveIntensity
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

export function createObjective(planId: string, body: ObjectivePayload): Promise<ObjectiveResponse> {
  return api.post<ObjectiveResponse>(`/api/plans/${planId}/objectives`, body)
}

export function updateObjective(objectiveId: string, body: UpdateObjectivePayload): Promise<ObjectiveResponse> {
  return api.put<ObjectiveResponse>(`/api/objectives/${objectiveId}`, body)
}

export function deleteObjective(objectiveId: string): Promise<void> {
  return api.delete(`/api/objectives/${objectiveId}`)
}

/* ── GPX course + pacing (P12) ─────────────────────────────────────── */

export type WaypointKind = 'AID_STATION' | 'SUMMIT' | 'POINT'

export interface CourseSplit {
  fromKm: number
  toKm: number
  climbM: number
  kmEffort: number
  segmentSec: number | null
  cumulativeSec: number | null
}

export interface CourseWaypoint {
  id: string
  name: string
  kind: WaypointKind
  distanceKm: number
  elevationM: number | null
  note: string | null
  climbToM: number
  kmEffort: number
  lowSec: number | null
  midSec: number | null
  highSec: number | null
}

export interface CourseResponse {
  id: string
  objectiveId: string
  name: string
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  kmEffort: number
  /** [[distance_m, elevation_m], …] for the elevation-profile chart. */
  profile: number[][]
  splits: CourseSplit[]
  waypoints: CourseWaypoint[]
  paceMedianSecPerKmEffort: number | null
  paceSampleRuns: number | null
  finishLowSec: number | null
  finishMidSec: number | null
  finishHighSec: number | null
}

export function fetchCourse(objectiveId: string): Promise<CourseResponse> {
  return api.get<CourseResponse>(`/api/objectives/${objectiveId}/course`)
}

export function importCourse(objectiveId: string, gpx: string, name?: string): Promise<CourseResponse> {
  return api.post<CourseResponse>(`/api/objectives/${objectiveId}/course`, { gpx, name })
}

export function deleteCourse(objectiveId: string): Promise<void> {
  return api.delete(`/api/objectives/${objectiveId}/course`)
}

export function deleteCourseWaypoint(objectiveId: string, waypointId: string): Promise<void> {
  return api.delete(`/api/objectives/${objectiveId}/course/waypoints/${waypointId}`)
}
