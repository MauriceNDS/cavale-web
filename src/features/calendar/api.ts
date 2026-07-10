import { api } from '../../lib/api'

export type Discipline = 'RUN' | 'GYM' | 'REST' | 'CROSS'
export type SessionStatus = 'PLANNED' | 'DONE' | 'SKIPPED' | 'MOVED'
export type WeekType =
  | 'RECOVERY'
  | 'TRANSITION'
  | 'BUILD'
  | 'DELOAD'
  | 'SHOCK'
  | 'TAPER'
  | 'RACE'

export interface ActivitySummary {
  source: 'MANUAL' | 'STRAVA'
  durationMin: number
  distanceKm: number | null
  elevationM: number | null
  avgHr: number | null
  comment: string | null
}

export interface SessionResponse {
  id: string
  weekId: string
  date: string
  orderInDay: number
  discipline: Discipline
  title: string
  detail: string | null
  zone: string | null
  durationMin: number | null
  elevationM: number | null
  rpeMin: number | null
  rpeMax: number | null
  status: SessionStatus
  activity: ActivitySummary | null
}

export interface PlanResponse {
  id: string
  name: string
  goal: string | null
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  startDate: string
  endDate: string
}

export interface WeekResponse {
  id: string
  weekNumber: number
  startDate: string
  phase: string | null
  weekType: WeekType
  targetVolumeKm: number | null
  targetElevationM: number | null
  targetLoadUa: number | null
  focus: string | null
}

export interface PlanDetailResponse {
  plan: PlanResponse
  weeks: WeekResponse[]
}

export function fetchCalendar(from: string, to: string): Promise<SessionResponse[]> {
  return api.get<SessionResponse[]>(`/api/calendar?from=${from}&to=${to}`)
}

export function fetchPlans(): Promise<PlanResponse[]> {
  return api.get<PlanResponse[]>('/api/plans')
}

export function fetchPlanDetail(planId: string): Promise<PlanDetailResponse> {
  return api.get<PlanDetailResponse>(`/api/plans/${planId}`)
}

export interface UpdateSessionRequest {
  date?: string
  orderInDay?: number
  status?: SessionStatus
}

export function updateSession(sessionId: string, body: UpdateSessionRequest): Promise<SessionResponse> {
  return api.patch<SessionResponse>(`/api/sessions/${sessionId}`, body)
}

export function updateWeek(weekId: string, body: { focus: string }): Promise<WeekResponse> {
  return api.patch<WeekResponse>(`/api/weeks/${weekId}`, body)
}

export interface ValidateSessionRequest {
  durationMin: number
  distanceKm: number
  elevationM?: number
  avgHr?: number
  comment?: string
}

export function validateSession(sessionId: string, body: ValidateSessionRequest): Promise<SessionResponse> {
  return api.post<SessionResponse>(`/api/sessions/${sessionId}/validate`, body)
}

export function validateSessionFromStrava(sessionId: string, stravaActivityId: number): Promise<SessionResponse> {
  return api.post<SessionResponse>(`/api/sessions/${sessionId}/validate-strava`, { stravaActivityId })
}
