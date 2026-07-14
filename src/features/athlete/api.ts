import { api } from '../../lib/api'
import type { AthleteStatus, UserResponse } from '../auth/api'
import type { ObjectiveResponse } from '../objective/api'

export type Timeframe = 'PAST' | 'CURRENT' | 'FUTURE'

export interface Season {
  planId: string
  planName: string
  planStatus: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  startDate: string
  endDate: string
  timeframe: Timeframe
  objective: ObjectiveResponse | null
}

export interface DistanceRecord {
  label: string
  distanceM: number
  seconds: number
  date: string
  activityName: string | null
}

export interface RunRef {
  date: string
  name: string | null
  distanceKm: number | null
  durationMin: number
}

export interface Prediction {
  label: string
  distanceM: number
  seconds: number
  paceSecPerKm: number
  basedOn: string
}

export interface PeriodTotals {
  runs: number
  distanceKm: number
  durationMin: number
  elevationM: number
}

export interface MonthlyStat {
  month: string
  runs: number
  distanceKm: number
  durationMin: number
  elevationM: number
  avgPaceSecPerKm: number | null
  avgHr: number | null
  avgCadenceSpm: number | null
  relativeEffort: number
}

export interface WeeklyEffort {
  weekStart: string
  relativeEffort: number
  distanceKm: number
}

export interface AthleteHub {
  profile: {
    displayName: string
    email: string
    weightKg: number | null
    heightCm: number | null
    birthDate: string | null
    maxHr: number | null
    restingHr: number | null
    memberSince: string
  }
  seasons: Season[]
  records: DistanceRecord[]
  longestRuns: { byDistance: RunRef | null; byDuration: RunRef | null }
  predictions: Prediction[]
  totals: { year: PeriodTotals; allTime: PeriodTotals }
  monthly: MonthlyStat[]
  weeklyEffort: WeeklyEffort[]
  sync: { stravaConnected: boolean; syncedActivities: number; recordsPending: number }
}

export function fetchHub(): Promise<AthleteHub> {
  return api.get<AthleteHub>('/api/athlete/hub')
}

export interface UpdateProfileRequest {
  displayName: string
  weightKg?: number | null
  heightCm?: number | null
  birthDate?: string | null
  maxHr?: number | null
  restingHr?: number | null
}

export function updateProfile(body: UpdateProfileRequest): Promise<UserResponse> {
  return api.put<UserResponse>('/api/users/me/profile', body)
}

export function updateStatus(body: { status: AthleteStatus; note?: string }): Promise<UserResponse> {
  return api.put<UserResponse>('/api/users/me/status', body)
}

export interface IssuedToken {
  token: string
  expiresAt: string
}

/** Long-lived personal access token — the MCP client credential. Shown once. */
export function issuePat(): Promise<IssuedToken> {
  return api.post<IssuedToken>('/api/users/me/pat', {})
}

/* ── Unified activities feed ───────────────────────────────────────── */

export type FeedType = 'ALL' | 'RUN' | 'GYM'

export interface FeedItem {
  id: string
  type: 'RUN' | 'GYM'
  date: string
  title: string | null
  durationMin: number | null
  perceivedEffort: string | null
  painFlag: boolean
  distanceKm: number | null
  elevationM: number | null
  avgHr: number | null
  paceSecPerKm: number | null
  source: 'MANUAL' | 'STRAVA' | null
  sessionId: string | null
  templateName: string | null
  tonnageKg: number | null
  sets: number | null
}

export interface ActivityFeedResponse {
  items: FeedItem[]
  page: number
  hasMore: boolean
}

export function fetchActivities(type: FeedType, page: number): Promise<ActivityFeedResponse> {
  return api.get<ActivityFeedResponse>(`/api/athlete/activities?type=${type}&page=${page}&size=20`)
}

export interface SyncResult {
  imported: number
  updated: number
  totalRuns: number
}

export interface AnalyzeResult {
  analyzed: number
  remaining: number
}

export function syncStravaHistory(): Promise<SyncResult> {
  return api.post<SyncResult>('/api/strava/sync-history', {})
}

export function analyzeStravaRecords(): Promise<AnalyzeResult> {
  return api.post<AnalyzeResult>('/api/strava/analyze-records', {})
}
