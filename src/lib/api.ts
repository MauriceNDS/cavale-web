/** Minimal typed API client over fetch, aware of RFC 9457 problem details. */

const TOKEN_KEY = 'cavale.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface ProblemDetail {
  type?: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, string>
}

export class ApiError extends Error {
  readonly problem: ProblemDetail

  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.title)
    this.problem = problem
  }

  get status(): number {
    return this.problem.status
  }
}

let onUnauthorized: (() => void) | null = null

/**
 * Register a handler for when an authenticated request is rejected with 401
 * (an expired or revoked token mid-session). The stored token is already
 * cleared by the time this fires; the handler resets in-app auth state so the
 * router drops back to the signed-out view. Auth endpoints are exempt — a bad
 * login must surface as a normal error, not trigger a logout.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const problem: ProblemDetail = await response
      .json()
      .catch(() => ({ title: response.statusText, status: response.status }))
    problem.status ??= response.status
    // A token we sent was rejected: it's stale — drop it and sign out. Skip the
    // auth endpoints (login/register/demo run signed-out; their 401s are normal).
    if (response.status === 401 && token && !path.startsWith('/api/auth/')) {
      clearToken()
      onUnauthorized?.()
    }
    throw new ApiError(problem)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
