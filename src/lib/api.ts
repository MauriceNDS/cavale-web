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

/**
 * Trade the refresh cookie for a new access token.
 *
 * The cookie is HttpOnly, so this code never sees the credential it is
 * spending — the browser attaches it because the request is same-origin and
 * `credentials: 'include'` asks it to.
 *
 * Shared promise: a page that fires eight queries at once and gets eight 401s
 * must renew ONCE. Eight parallel refreshes would rotate the token eight
 * times, and seven of them would look exactly like a replayed secret — which
 * the server answers by cutting every session on the account.
 */
let renewal: Promise<boolean> | null = null

function renewSession(): Promise<boolean> {
  renewal ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) return false
      const body = (await response.json()) as { token?: string }
      if (!body.token) return false
      setToken(body.token)
      return true
    })
    .catch(() => false)
    .finally(() => {
      // Let the next 401 start a fresh attempt rather than reusing this answer.
      setTimeout(() => {
        renewal = null
      }, 0)
    })
  return renewal
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken()
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isAuthCall = path.startsWith('/api/auth/')
  let response = await send(path, init)

  // An expired access token is the normal case now, not a reason to sign out:
  // renew behind the athlete's back and replay the call once.
  if (response.status === 401 && !isAuthCall && (await renewSession())) {
    response = await send(path, init)
  }

  if (!response.ok) {
    const problem: ProblemDetail = await response
      .json()
      .catch(() => ({ title: response.statusText, status: response.status }))
    problem.status ??= response.status
    // Still 401 after a renewal attempt: the refresh token is gone too, so the
    // session really is over. Auth endpoints are exempt — a bad login must
    // surface as a normal error, not trigger a logout.
    if (response.status === 401 && !isAuthCall) {
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
