import { api, getToken } from '../../lib/api'
import type { ObjectivePayload } from '../objective/api'

export type Discipline = 'RUN' | 'GYM' | 'CROSS' | 'HIKE'
export type SessionStatus = 'PLANNED' | 'DONE' | 'SKIPPED' | 'MOVED'
export type WeekType =
  | 'RECOVERY'
  | 'TRANSITION'
  | 'BUILD'
  | 'DELOAD'
  | 'SHOCK'
  | 'TAPER'
  | 'RACE'

export type PerceivedEffort = 'TROP_FACILE' | 'FACILE' | 'COMME_PREVU' | 'DIFFICILE' | 'TROP_DIFFICILE'

export interface ActivitySummary {
  source: 'MANUAL' | 'STRAVA'
  name: string | null
  durationMin: number
  distanceKm: number | null
  elevationM: number | null
  avgHr: number | null
  avgCadenceSpm: number | null
  perceivedEffort: PerceivedEffort | null
  painFlag: boolean
  comment: string | null
  hasStreams: boolean
  activityId: string
  shoeId: string | null
}

export interface ActivityStreams {
  time: number[]
  /** Cumulative seconds spent MOVING — `time` minus everything the athlete
   *  stood still for. Integrated before downsampling, so it sees pauses that
   *  fall between two kept samples. Absent on streams stored before it was
   *  recorded; consumers then fall back to a stationary heuristic. */
  mtime?: number[]
  distance: number[]
  hr: number[]
  alt: number[]
  vel: number[]
  /** Steps per minute (both legs). Absent on streams stored before cadence support. */
  cad?: number[]
}

export type Allure = 'LENTE' | 'EF' | 'COURSE' | 'SEUIL60' | 'SEUIL30' | 'VMA' | 'SPRINT'
export type Terrain = 'PLAT' | 'COTE' | 'DESCENTE'

export interface WorkoutNode {
  type: 'step' | 'repeat'
  allure: Allure | null
  seconds: number | null
  terrain: Terrain | null
  count: number | null
  children: WorkoutNode[] | null
}

export interface SessionResponse {
  id: string
  weekId: string
  date: string
  orderInDay: number
  discipline: Discipline
  title: string
  detail: string | null
  comment: string | null
  zone: string | null
  durationMin: number | null
  elevationM: number | null
  rpeMin: number | null
  rpeMax: number | null
  status: SessionStatus
  /** Real minutes once DONE — the activity's for a run, the workout log's for gym. */
  actualDurationMin: number | null
  activity: ActivitySummary | null
  workout: WorkoutNode[]
  structureNotes: string | null
  templateVariantId: string | null
  templateName: string | null
  variantLabel: string | null
}

export type PlanFocus = 'MAINTAIN' | 'SPEED' | 'ENDURANCE'

export interface PlanResponse {
  id: string
  name: string
  goal: string | null
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  startDate: string
  endDate: string
  runsPerWeek: number | null
  gymPerWeek: number | null
  focus: PlanFocus | null
}

export interface WeekResponse {
  id: string
  weekNumber: number
  startDate: string
  phase: string | null
  weekType: WeekType
  targetVolumeKm: number | null
  /** Km the prescribed session times should actually produce (personal pace model). */
  estimatedVolumeKm: number | null
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

export interface CreatePlanRequest {
  name: string
  goal?: string
  startDate: string
  endDate: string
  runsPerWeek?: number
  gymPerWeek?: number
  focus?: PlanFocus
  /** Full MAIN objective details; the API builds a placeholder when omitted. */
  objective?: ObjectivePayload
}

export function createPlan(body: CreatePlanRequest): Promise<PlanResponse> {
  return api.post<PlanResponse>('/api/plans', body)
}

/** Scaffold the periodized weeks of an empty plan, optionally with default sessions. */
export function scaffoldPlan(planId: string, fillSessions: boolean): Promise<WeekResponse[]> {
  return api.post<WeekResponse[]>(`/api/plans/${planId}/scaffold?fillSessions=${fillSessions}`, undefined)
}

/** The athlete's derived paces, refit continuously from his own runs. */
export interface PaceContextResponse {
  flatSecPerKm: Record<Allure, number>
  climbSecPerMeter: number
  sampleSize: number
  personal: boolean
  /** True when the quality paces are anchored on the fitted critical speed. */
  thresholdAnchored: boolean
  cpSecPerKm: number | null
  /** HR anchor for the zone bands — profile override, else observed max. */
  maxHr: number | null
  maxHrFromProfile: boolean
  /** Lactate-threshold HR from a field test — preferred zone anchor when set. */
  lthr: number | null
  roadContext: boolean
  goalPaceSecPerKm: number | null
}

export function fetchPaceModel(): Promise<PaceContextResponse> {
  return api.get<PaceContextResponse>('/api/pace-model')
}

/** Deletes the season and everything in it (weeks, sessions, objectives). */
export function deletePlan(planId: string): Promise<void> {
  return api.delete(`/api/plans/${planId}`)
}

export function fetchPlanDetail(planId: string): Promise<PlanDetailResponse> {
  return api.get<PlanDetailResponse>(`/api/plans/${planId}`)
}

export interface UpdateSessionRequest {
  date?: string
  orderInDay?: number
  status?: SessionStatus
  comment?: string
  workout?: WorkoutNode[]
  templateVariantId?: string
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
  perceivedEffort?: PerceivedEffort
  painFlag?: boolean
  shoeId?: string | null
  comment?: string
}

export function validateSession(sessionId: string, body: ValidateSessionRequest): Promise<SessionResponse> {
  return api.post<SessionResponse>(`/api/sessions/${sessionId}/validate`, body)
}

export interface ImportStravaRequest {
  stravaActivityId: number
  perceivedEffort?: PerceivedEffort
  painFlag?: boolean
  shoeId?: string | null
  comment?: string
}

export function validateSessionFromStrava(sessionId: string, body: ImportStravaRequest): Promise<SessionResponse> {
  return api.post<SessionResponse>(`/api/sessions/${sessionId}/validate-strava`, body)
}

export function fetchSession(sessionId: string): Promise<SessionResponse> {
  return api.get<SessionResponse>(`/api/sessions/${sessionId}`)
}

/** Downloads the session's Garmin workout as cavale-<date>.fit. */
export async function downloadSessionFit(session: Pick<SessionResponse, 'id' | 'date'>): Promise<void> {
  const response = await fetch(`/api/sessions/${session.id}/export.fit`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!response.ok) throw new Error('export failed')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cavale-${session.date}.fit`
  link.click()
  URL.revokeObjectURL(url)
}

export interface SessionProposal {
  activityId: string
  stravaActivityId: number
  name: string | null
  date: string
  durationMin: number
  distanceKm: number | null
  elevationM: number | null
  avgHr: number | null
}

/** Ingested Strava run that likely matches the session — null when none (204). */
export async function fetchSessionProposal(sessionId: string): Promise<SessionProposal | null> {
  const proposal = await api.get<SessionProposal | undefined>(`/api/sessions/${sessionId}/proposal`)
  return proposal ?? null
}

export function fetchSessionStreams(sessionId: string): Promise<ActivityStreams> {
  return api.get<ActivityStreams>(`/api/sessions/${sessionId}/streams`)
}

export interface CreateSessionRequest {
  date: string
  orderInDay: number
  discipline: Discipline
  title: string
  detail?: string
  zone?: string
  durationMin?: number
  elevationM?: number
  rpeMin?: number
  rpeMax?: number
  workout?: WorkoutNode[]
  templateVariantId?: string
}

export function createSession(weekId: string, body: CreateSessionRequest): Promise<SessionResponse> {
  return api.post<SessionResponse>(`/api/weeks/${weekId}/sessions`, body)
}
