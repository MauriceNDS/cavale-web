import { api } from '../../lib/api'

export interface StravaStatus {
  configured: boolean
  connected: boolean
  athleteId: number | null
  lastSyncAt: string | null
}

export interface SyncResult {
  fetched: number
  matched: number
  alreadyImported: number
  unmatched: number
}

export function fetchStravaStatus(): Promise<StravaStatus> {
  return api.get<StravaStatus>('/api/strava/status')
}

export function fetchAuthorizeUrl(): Promise<{ url: string }> {
  return api.get<{ url: string }>('/api/strava/authorize-url')
}

export function syncStrava(): Promise<SyncResult> {
  return api.post<SyncResult>('/api/strava/sync', {})
}

export function disconnectStrava(): Promise<void> {
  return api.delete('/api/strava/connection')
}
