import { api } from '../../lib/api'

export interface StravaStatus {
  configured: boolean
  connected: boolean
  athleteId: number | null
  lastSyncAt: string | null
}

export interface StravaActivityOption {
  id: number
  name: string
  date: string
  durationMin: number
  distanceKm: number
  elevationM: number | null
  avgHr: number | null
}

export function fetchStravaStatus(): Promise<StravaStatus> {
  return api.get<StravaStatus>('/api/strava/status')
}

export function fetchAuthorizeUrl(): Promise<{ url: string }> {
  return api.get<{ url: string }>('/api/strava/authorize-url')
}

/** Recent Strava runs not yet attached to any session. */
export function fetchStravaActivities(): Promise<StravaActivityOption[]> {
  return api.get<StravaActivityOption[]>('/api/strava/activities')
}

export function disconnectStrava(): Promise<void> {
  return api.delete('/api/strava/connection')
}
