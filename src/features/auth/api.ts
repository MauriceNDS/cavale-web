import { api } from '../../lib/api'

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

export interface LoginRequest {
  email: string
  password: string
}

export type AthleteStatus = 'AVAILABLE' | 'INJURED' | 'RECOVERING' | 'SICK'

export interface UserResponse {
  id: string
  email: string
  displayName: string
  weightKg: number | null
  heightCm: number | null
  birthDate: string | null
  maxHr: number | null
  restingHr: number | null
  gymEnabled: boolean
  preferredLanguage: 'fr' | 'en'
  athleteStatus: AthleteStatus
  statusNote: string | null
  statusSince: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: UserResponse
}

export function registerUser(request: RegisterRequest): Promise<UserResponse> {
  return api.post<UserResponse>('/api/auth/register', request)
}

export function loginUser(request: LoginRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/login', request)
}

export function fetchMe(): Promise<UserResponse> {
  return api.get<UserResponse>('/api/users/me')
}
