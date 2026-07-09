import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { useAuth } from './features/auth/session'
import { CalendarPage } from './features/calendar/CalendarPage'
import { SettingsPage } from './features/settings/SettingsPage'

/* ── Navigation model ──────────────────────────────────────────────── */

interface NavItem {
  label: string
  to?: '/' | '/settings'
  soon?: boolean
}

const NAV: NavItem[] = [
  { label: 'Calendrier', to: '/' },
  { label: 'Plan', soon: true },
  { label: 'Renfo', soon: true },
  { label: 'Théorie', soon: true },
  { label: 'Stats', soon: true },
  { label: 'Réglages', to: '/settings' },
]

function NavLinks({ vertical }: { vertical?: boolean }) {
  return (
    <>
      {NAV.map((item) =>
        item.soon ? (
          <span
            key={item.label}
            title="Bientôt"
            className={`flex items-center gap-2 text-moss-400 dark:text-moss-500 ${
              vertical ? 'rounded-lg px-3 py-2 text-sm' : 'flex-col py-1 text-[11px]'
            } cursor-default`}
          >
            {item.label}
            {vertical && (
              <span className="ml-auto rounded-full bg-moss-100 px-1.5 py-0.5 text-[10px] font-medium text-moss-500 dark:bg-moss-800 dark:text-moss-400">
                bientôt
              </span>
            )}
          </span>
        ) : (
          <Link
            key={item.label}
            to={item.to ?? '/'}
            className={`font-medium transition ${
              vertical
                ? 'flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-moss-100 dark:text-linen dark:hover:bg-moss-800 [&.active]:bg-pine-100 dark:[&.active]:bg-pine-900'
                : 'flex flex-col items-center py-1 text-[11px] text-moss-500 dark:text-moss-400 [&.active]:text-pine-700 dark:[&.active]:text-pine-300'
            }`}
          >
            {item.label}
          </Link>
        ),
      )}
    </>
  )
}

/* ── App shell ─────────────────────────────────────────────────────── */

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    // Signed-out chrome: slim public header
    return (
      <div className="min-h-screen">
        <header className="border-b border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link to="/" className="font-display text-xl font-semibold text-pine-700 dark:text-pine-300">
              Cavale
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen [&.active]:text-ink dark:[&.active]:text-linen"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-pine-600 px-3.5 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
              >
                Créer un compte
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
      </div>
    )
  }

  // Signed-in chrome: sidebar (desktop) + bottom tabs (mobile)
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-moss-200 bg-moss-25 p-4 md:flex dark:border-moss-750 dark:bg-moss-850">
        <Link to="/" className="mb-6 px-3 font-display text-2xl font-semibold text-pine-700 dark:text-pine-300">
          Cavale
        </Link>
        <nav className="flex flex-col gap-1">
          <NavLinks vertical />
        </nav>
        <div className="mt-auto border-t border-moss-200 pt-3 dark:border-moss-750">
          <p className="truncate px-3 text-sm font-medium">{user.displayName}</p>
          <button
            onClick={() => {
              logout()
              navigate({ to: '/login' })
            }}
            className="px-3 py-1 text-sm text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-moss-200 bg-moss-25 px-4 py-2.5 dark:border-moss-750 dark:bg-moss-850">
          <span className="font-display text-lg font-semibold text-pine-700 md:hidden dark:text-pine-300">
            Cavale
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-moss-500 md:block dark:text-moss-400">
              {user.email}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 pb-24 md:px-8 md:pb-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 grid grid-cols-6 border-t border-moss-200 bg-moss-25/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-moss-750 dark:bg-moss-850/95">
          <NavLinks />
        </nav>
      </div>
    </div>
  )
}

/* ── Pages ─────────────────────────────────────────────────────────── */

function Home() {
  const { user } = useAuth()

  if (user === undefined) {
    return <p className="mt-16 text-center text-moss-500 dark:text-moss-400">Chargement…</p>
  }

  if (user) {
    return <CalendarPage />
  }

  return (
    <div className="mt-20 text-center">
      <h1 className="font-display text-5xl font-semibold text-balance">
        Cavale <span className="text-pine-600 dark:text-pine-350">/ka.val/</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-moss-500 dark:text-moss-400">
        Compagnon d'entraînement ultra-trail — plans, renfo et progression, au même endroit.
      </p>
      <div className="mt-10">
        <Link
          to="/register"
          className="rounded-lg bg-pine-600 px-6 py-3 font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          Commencer l'entraînement
        </Link>
      </div>
    </div>
  )
}

/* ── Route tree ────────────────────────────────────────────────────── */

const rootRoute = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
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

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, registerRoute, loginRoute, settingsRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
