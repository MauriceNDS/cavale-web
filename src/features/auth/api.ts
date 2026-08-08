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

/** Admin-controlled account access, distinct from athlete availability. */
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'DISABLED'
export type UserRole = 'USER' | 'ADMIN'

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
  accountStatus: AccountStatus
  role: UserRole
  /** Ephemeral portfolio demo account — sandboxed, auto-deleted. */
  demo: boolean
  /** False for Strava-born accounts that never set a real email + password. */
  hasCredentials: boolean
  createdAt: string
}

/** Claim a Strava-born account: set the real email + password pair. */
export function setCredentials(body: { email: string; password: string }): Promise<UserResponse> {
  return api.put<UserResponse>('/api/users/me/credentials', body)
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

/**
 * Revoke this device's refresh token and clear its cookie. Best-effort: a
 * failure here must never keep the athlete stuck on a screen they asked to
 * leave, so the caller signs out locally regardless.
 */
export function logoutUser(): Promise<void> {
  return api.post<void>('/api/auth/logout', {}).catch(() => undefined)
}

export function fetchMe(): Promise<UserResponse> {
  return api.get<UserResponse>('/api/users/me')
}

/** Provision a throwaway, fully-seeded demo session (no sign-up). */
export function startDemo(): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/demo', {})
}

/** Whether this deployment's passwordless dev door is open (dev env only). */
export function fetchDevLoginEnabled(): Promise<{ enabled: boolean }> {
  return api.get<{ enabled: boolean }>('/api/auth/dev-login')
}

/** Dev only: exchange a known email for a session, no password. */
export function devLogin(email: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/api/auth/dev-login', { email })
}
