import { api } from '../../lib/api'

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

export interface UserResponse {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export function registerUser(request: RegisterRequest): Promise<UserResponse> {
  return api.post<UserResponse>('/api/auth/register', request)
}
