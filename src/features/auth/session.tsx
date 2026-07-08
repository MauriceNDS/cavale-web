import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearToken, getToken, setToken } from '../../lib/api'
import { fetchMe, loginUser, type UserResponse } from './api'

interface AuthState {
  /** undefined = session still being restored; null = signed out */
  user: UserResponse | null | undefined
  login: (email: string, password: string) => Promise<UserResponse>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null | undefined>(
    getToken() ? undefined : null,
  )

  // Restore the session on app load: a stored token is only trusted after /me confirms it.
  useEffect(() => {
    if (!getToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        setUser(null)
      })
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

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
