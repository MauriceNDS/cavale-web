import { api } from '../../lib/api'

export type ShoePurpose = 'ROAD' | 'TRAIL' | 'RACE'

export interface ShoeResponse {
  id: string
  name: string
  brand: string | null
  purpose: ShoePurpose | null
  retirementKm: number | null
  retired: boolean
  mileageKm: number
  needsRetirement: boolean
}

export interface ShoePayload {
  name: string
  brand?: string | null
  purpose?: ShoePurpose | null
  retirementKm?: number | null
  retired?: boolean
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
