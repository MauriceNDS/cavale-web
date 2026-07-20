import { api } from '../../lib/api'

export interface IntervalsStatus {
  connected: boolean
  athleteId: string | null
  athleteName: string | null
  lastPushAt: string | null
}

export interface PushResult {
  pushed: number
}

export function fetchIntervalsStatus(): Promise<IntervalsStatus> {
  return api.get<IntervalsStatus>('/api/intervals/status')
}

/** Validates the key against Intervals.icu before storing it. */
export function connectIntervals(apiKey: string): Promise<IntervalsStatus> {
  return api.post<IntervalsStatus>('/api/intervals/connection', { apiKey })
}

export function disconnectIntervals(): Promise<void> {
  return api.delete('/api/intervals/connection')
}

/** Push the upcoming planned runs to the Intervals.icu calendar → the watch. */
export function pushIntervals(): Promise<PushResult> {
  return api.post<PushResult>('/api/intervals/push', {})
}

/** Export one session to the watch (Export → Garmin Connect). */
export function pushSessionToGarmin(sessionId: string): Promise<PushResult> {
  return api.post<PushResult>(`/api/intervals/push/${sessionId}`, {})
}
