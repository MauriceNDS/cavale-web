import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { useAuth } from './features/auth/session'

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="border-b border-slate-200 bg-slate-900">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-tight text-cavale-400">
          Cavale
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-slate-300">{user.displayName}</span>
              <button
                onClick={() => {
                  logout()
                  navigate({ to: '/login' })
                }}
                className="text-sm text-slate-400 transition hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-slate-300 transition hover:text-white [&.active]:text-white"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-cavale-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-cavale-600"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

function Home() {
  const { user } = useAuth()

  if (user) {
    return (
      <div className="mt-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Salut, {user.displayName} 👋
        </h1>
        <p className="mt-2 text-slate-600">
          Your dashboard is on its way — training calendar, plan, and gym
          sessions will land here.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-16 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
        Cavale <span className="text-cavale-500">/ka.val/</span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">
        Training companion for ultra-trail running — plans, strength work, and
        progress, all in one place.
      </p>
      <div className="mt-8">
        <Link
          to="/register"
          className="rounded-lg bg-cavale-500 px-5 py-2.5 font-semibold text-white transition hover:bg-cavale-600"
        >
          Start training
        </Link>
      </div>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Outlet />
      </main>
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const routeTree = rootRoute.addChildren([indexRoute, registerRoute, loginRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
