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
