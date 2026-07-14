import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { LogoMark } from './components/LogoMark'
import { ThemeToggle } from './components/ThemeToggle'
import type { UserResponse } from './features/auth/api'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { StravaCallbackPage } from './features/auth/StravaCallbackPage'
import { useAuth } from './features/auth/session'
import { HomePage } from './features/athlete/HomePage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { SessionPage } from './features/calendar/SessionPage'
import { ExercisesPage } from './features/gym/ExercisesPage'
import { TemplateEditorPage } from './features/gym/TemplateEditorPage'
import { TemplatesPage } from './features/gym/TemplatesPage'
import { ObjectivePage } from './features/objective/ObjectivePage'
import { SettingsPage } from './features/settings/SettingsPage'

/* ── Navigation model ──────────────────────────────────────────────── */

interface IconProps {
  className?: string
}

function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 19 9.5 6.5l4 7 2.5-3.5L21 19Z" />
    </svg>
  )
}

function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function IconTarget({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  )
}

function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
      <circle cx="15" cy="7" r="2.5" />
      <circle cx="9" cy="17" r="2.5" />
    </svg>
  )
}

function IconDumbbell({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 12h7M5 9v6M8.5 7.5v9M15.5 7.5v9M19 9v6M2.5 10.5v3M21.5 10.5v3" />
    </svg>
  )
}

interface NavItem {
  label: string
  to?: '/' | '/calendrier' | '/objectif' | '/renfo' | '/settings'
  icon?: (props: IconProps) => ReactNode
  soon?: boolean
}

const NAV: NavItem[] = [
  { label: 'Accueil', to: '/', icon: IconHome },
  { label: 'Calendrier', to: '/calendrier', icon: IconCalendar },
  { label: 'Renfo', to: '/renfo', icon: IconDumbbell },
  { label: 'Objectif', to: '/objectif', icon: IconTarget },
  { label: 'Réglages', to: '/settings', icon: IconSettings },
]

/** Mobile header title: the shell names the page, pages keep their own h1. */
function pageTitle(pathname: string): string {
  if (pathname.startsWith('/calendrier')) return 'Calendrier'
  if (pathname.startsWith('/session')) return 'Séance'
  if (pathname.startsWith('/renfo')) return 'Renfo'
  if (pathname.startsWith('/objectif')) return 'Objectif'
  if (pathname.startsWith('/settings')) return 'Réglages'
  return 'Accueil'
}

/** Desktop sidebar entries — the full map, "bientôt" items included. */
function SidebarLinks() {
  return (
    <>
      {NAV.map((item) =>
        item.soon ? (
          <span
            key={item.label}
            title="Bientôt"
            className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-moss-400 dark:text-moss-500"
          >
            {item.label}
            <span className="ml-auto rounded-full bg-moss-100 px-1.5 py-0.5 text-[10px] font-medium text-moss-500 dark:bg-moss-800 dark:text-moss-400">
              bientôt
            </span>
          </span>
        ) : (
          <Link
            key={item.label}
            to={item.to ?? '/'}
            activeOptions={{ exact: item.to === '/' }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:bg-moss-100 dark:text-linen dark:hover:bg-moss-800 [&.active]:bg-pine-100 dark:[&.active]:bg-pine-900"
          >
            {item.icon && <item.icon className="h-4.5 w-4.5 text-moss-500 dark:text-moss-400" />}
            {item.label}
          </Link>
        ),
      )}
    </>
  )
}

/** Mobile bottom bar: only real destinations, icon-first, thumb-sized. */
function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-moss-200 bg-moss-25/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-moss-750 dark:bg-moss-850/95">
      {NAV.filter((item) => item.to).map((item) => (
        <Link
          key={item.label}
          to={item.to!}
          activeOptions={{ exact: item.to === '/' }}
          className="flex flex-col items-center gap-0.5 pt-1.5 pb-2 text-[10px] font-medium text-moss-500 transition dark:text-moss-400 [&.active]:text-pine-700 dark:[&.active]:text-pine-300 [&.active_.tab-pill]:bg-pine-100 dark:[&.active_.tab-pill]:bg-pine-900"
        >
          <span className="tab-pill grid h-7 w-12 place-items-center rounded-full transition">
            {item.icon && <item.icon className="h-5.5 w-5.5" />}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/** Mobile account menu: identity, theme and logout live here — the desktop
 *  sidebar footer doesn't exist below md. */
function AccountMenu({ user, onLogout }: { user: UserResponse; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const initial = (user.displayName || user.email).charAt(0).toUpperCase()

  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Compte"
        className="grid h-8 w-8 place-items-center rounded-full bg-pine-600 text-sm font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute top-10 right-0 z-50 w-60 rounded-xl border border-moss-200 bg-moss-25 p-2 shadow-lg dark:border-moss-750 dark:bg-moss-850"
          >
            <div className="border-b border-moss-200 px-3 pt-1 pb-2.5 dark:border-moss-750">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="truncate text-xs text-moss-500 dark:text-moss-400">{user.email}</p>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-sm">
              Thème
              <ThemeToggle />
            </div>
            <button
              role="menuitem"
              onClick={onLogout}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-clay-500 transition hover:bg-moss-100 dark:text-clay-300 dark:hover:bg-moss-800"
            >
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── App shell ─────────────────────────────────────────────────────── */

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (!user) {
    // Signed-out chrome: slim public header
    return (
      <div className="min-h-screen">
        <header className="border-b border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-xl font-semibold text-pine-700 dark:text-pine-300"
            >
              <LogoMark className="h-4 w-auto" />
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
        <Link
          to="/"
          className="mb-6 flex items-center gap-2.5 px-3 font-display text-2xl font-semibold text-pine-700 dark:text-pine-300"
        >
          <LogoMark className="h-5 w-auto" />
          Cavale
        </Link>
        <nav className="flex flex-col gap-1">
          <SidebarLinks />
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
        <header className="flex items-center gap-3 border-b border-moss-200 bg-moss-25 px-4 py-2 md:py-2.5 dark:border-moss-750 dark:bg-moss-850">
          <span className="font-display text-lg font-semibold md:hidden">
            {pageTitle(pathname)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <span className="hidden text-sm text-moss-500 md:block dark:text-moss-400">
              {user.email}
            </span>
            <AccountMenu
              user={user}
              onLogout={() => {
                logout()
                navigate({ to: '/login' })
              }}
            />
          </div>
        </header>
        <main className="flex-1 px-4 pb-24 md:px-8 md:pb-10">{children}</main>
        <TabBar />
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
    return <HomePage />
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

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendrier',
  component: CalendarPage,
  validateSearch: (search: Record<string, unknown>): { week?: string } =>
    typeof search.week === 'string' ? { week: search.week } : {},
})

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session/$sessionId',
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === 'string' ? { from: search.from } : {},
})

const objectiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objectif',
  component: ObjectivePage,
})

const renfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renfo',
  component: TemplatesPage,
})

const exercisesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renfo/exercices',
  component: ExercisesPage,
})

const templateEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renfo/programmes/$templateId',
  component: TemplateEditorPage,
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

const stravaCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/strava',
  component: StravaCallbackPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  sessionRoute,
  objectiveRoute,
  renfoRoute,
  exercisesRoute,
  templateEditorRoute,
  registerRoute,
  loginRoute,
  settingsRoute,
  stravaCallbackRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
