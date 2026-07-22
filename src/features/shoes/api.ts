import { api } from '../../lib/api'

export type ShoePurpose = 'ROAD' | 'TRAIL' | 'RACE'

export interface ShoeResponse {
  id: string
  name: string
  brand: string | null
  color: string | null
  purpose: ShoePurpose | null
  retirementKm: number | null
  retired: boolean
  isDefault: boolean
  mileageKm: number
  needsRetirement: boolean
}

export interface ShoePayload {
  name: string
  brand?: string | null
  color?: string | null
  purpose?: ShoePurpose | null
  retirementKm?: number | null
  retired?: boolean
  isDefault?: boolean
}

export function fetchShoes(): Promise<ShoeResponse[]> {
  return api.get<ShoeResponse[]>('/api/shoes')
}

export function createShoe(body: ShoePayload): Promise<ShoeResponse> {
  return api.post<ShoeResponse>('/api/shoes', body)
}

export function updateShoe(id: string, body: ShoePayload): Promise<ShoeResponse> {
  return api.put<ShoeResponse>(`/api/shoes/${id}`, body)
}

export function deleteShoe(id: string): Promise<void> {
  return api.delete(`/api/shoes/${id}`)
}

export interface ShoeStatsResponse {
  runs: number
  totalKm: number
  totalElevationM: number
  firstUsedOn: string | null
  lastUsedOn: string | null
  avgPaceSecPerKm: number | null
  monthlyKm: { month: string; km: number }[]
}

export function fetchShoeStats(id: string): Promise<ShoeStatsResponse> {
  return api.get<ShoeStatsResponse>(`/api/shoes/${id}/stats`)
}

/** Assign a pair to an activity after the fact — null clears it. */
export function assignShoeToActivity(
  activityId: string,
  shoeId: string | null,
): Promise<{ shoeId: string | null }> {
  return api.put<{ shoeId: string | null }>(`/api/shoes/of-activity/${activityId}`, { shoeId })
}
