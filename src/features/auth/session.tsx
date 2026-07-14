import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, clearToken, getToken, setToken } from '../../lib/api'
import { fetchMe, loginUser, type UserResponse } from './api'

interface AuthState {
  /** undefined = session still being restored; null = signed out */
  user: UserResponse | null | undefined
  login: (email: string, password: string) => Promise<UserResponse>
  logout: () => void
  /** Re-fetch /me after a profile change so the shell reflects it. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null | undefined>(
    getToken() ? undefined : null,
  )

  // Restore the session on app load: a stored token is only trusted after /me confirms it.
  // Drop the token ONLY when the server rejects it (401) — a network hiccup or an
  // API restart must not log the user out; retry once, then give up for this load.
  useEffect(() => {
    if (!getToken()) return
    let cancelled = false

    function restore(attempt: number) {
      fetchMe()
        .then((me) => {
          if (!cancelled) setUser(me)
        })
        .catch((error) => {
          if (cancelled) return
          if (error instanceof ApiError && error.status === 401) {
            clearToken()
            setUser(null)
          } else if (attempt < 2) {
            setTimeout(() => restore(attempt + 1), 1500)
          } else {
            setUser(null) // token kept — next load will try again
          }
        })
    }

    restore(0)
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const auth = await loginUser({ email, password })
    setToken(auth.token)
    setUser(auth.user)
    return auth.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!getToken()) return
    setUser(await fetchMe())
  }, [])

  const value = useMemo(() => ({ user, login, logout, refresh }), [user, login, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
