import { api } from '../../lib/api'
import type { AccountStatus, UserRole } from '../auth/api'

/** The lean account view the admin console lists (no athlete body metrics). */
export interface AdminUser {
  id: string
  email: string
  displayName: string
  accountStatus: AccountStatus
  role: UserRole
  createdAt: string
}

/** Access-status filter for the list; `null` = every account. */
export type StatusFilter = AccountStatus | null

export function fetchUsers(status: StatusFilter): Promise<AdminUser[]> {
  const query = status ? `?status=${status}` : ''
  return api.get<AdminUser[]>(`/api/admin/users${query}`)
}

export function activateUser(id: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/api/admin/users/${id}/activate`, {})
}

export function deactivateUser(id: string): Promise<AdminUser> {
  return api.post<AdminUser>(`/api/admin/users/${id}/deactivate`, {})
}
