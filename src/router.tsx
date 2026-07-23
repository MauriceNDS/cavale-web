import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Navigate,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LogoMark } from './components/LogoMark'
import { ThemeToggle } from './components/ThemeToggle'
import type { UserResponse } from './features/auth/api'
import { DemoButton } from './features/auth/DemoButton'
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
import { WorkoutPage } from './features/gym/WorkoutPage'
import { ActivitiesPage } from './features/athlete/ActivitiesPage'
import { ActivityDetailPage } from './features/athlete/ActivityDetailPage'
import { StatsPage } from './features/stats/StatsPage'
import { ObjectivePage } from './features/objective/ObjectivePage'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { PendingApprovalPage } from './features/auth/PendingApprovalPage'
import { ParametersPage } from './features/settings/ParametersPage'
import { ProfilePage } from './features/settings/ProfilePage'
import { UsersAdminPage } from './features/admin/UsersAdminPage'

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

function IconPulse({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
    </svg>
  )
}

function IconChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  )
}

function IconUser({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  )
}

function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 6.8M18.5 20c-.4-1.4-1.1-2.6-2-3.5" />
    </svg>
  )
}

interface NavItem {
  /** shell-namespace translation key. */
  label: string
  to?: '/' | '/planning' | '/objectif' | '/renfo' | '/activites' | '/stats'
  icon?: (props: IconProps) => ReactNode
  /** In the mobile bottom bar; the rest lives in the account menu. */
  mobileTab?: boolean
  /** Hidden entirely when the athlete uses Cavale for running only. */
  needsGym?: boolean
}

const NAV: NavItem[] = [
  { label: 'nav.home', to: '/', icon: IconHome, mobileTab: true },
  { label: 'nav.calendar', to: '/planning', icon: IconCalendar, mobileTab: true },
  { label: 'nav.gym', to: '/renfo', icon: IconDumbbell, mobileTab: true, needsGym: true },
  { label: 'nav.activities', to: '/activites', icon: IconPulse, mobileTab: true },
  { label: 'nav.stats', to: '/stats', icon: IconChart },
  { label: 'nav.objective', to: '/objectif', icon: IconTarget },
]

function visibleNav(gymEnabled: boolean): NavItem[] {
  return NAV.filter((item) => gymEnabled || !item.needsGym)
}

/** Desktop sidebar entries. */
function SidebarLinks({ gymEnabled }: { gymEnabled: boolean }) {
  const { t } = useTranslation('shell')
  return (
    <>
      {visibleNav(gymEnabled).map((item) => (
        <Link
          key={item.label}
          to={item.to ?? '/'}
          activeOptions={{ exact: item.to === '/' }}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:bg-moss-100 dark:text-linen dark:hover:bg-moss-800 [&.active]:bg-pine-100 dark:[&.active]:bg-pine-900"
        >
          {item.icon && <item.icon className="h-4.5 w-4.5 text-moss-500 dark:text-moss-400" />}
          {t(item.label)}
        </Link>
      ))}
    </>
  )
}

/** Shared body of the account menus: profile, parameters, theme mode, logout. */
function AccountMenuItems({
  extraNav,
  showAdmin,
  onNavigate,
  onLogout,
}: {
  /** Destinations that have no tab of their own (mobile sheet only). */
  extraNav?: NavItem[]
  /** Admins get a link to the user-management console. */
  showAdmin?: boolean
  onNavigate: () => void
  onLogout: () => void
}) {
  const { t } = useTranslation('shell')
  const itemCls =
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:bg-moss-100 dark:text-linen dark:hover:bg-moss-800'
  const iconCls = 'h-4.5 w-4.5 text-moss-500 dark:text-moss-400'

  return (
    <>
      {extraNav?.map((item) => (
        <Link key={item.label} to={item.to!} role="menuitem" onClick={onNavigate} className={itemCls}>
          {item.icon && <item.icon className={iconCls} />}
          {t(item.label)}
        </Link>
      ))}
      {showAdmin && (
        <Link to="/admin" role="menuitem" onClick={onNavigate} className={itemCls}>
          <IconUsers className={iconCls} />
          {t('nav.admin')}
        </Link>
      )}
      <Link to="/profil" role="menuitem" onClick={onNavigate} className={itemCls}>
        <IconUser className={iconCls} />
        {t('account.viewProfile')}
      </Link>
      <Link to="/parametres" role="menuitem" onClick={onNavigate} className={itemCls}>
        <IconSettings className={iconCls} />
        {t('account.parameters')}
      </Link>
      <button
        role="menuitem"
        onClick={onLogout}
        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-clay-500 transition hover:bg-moss-100 dark:text-clay-300 dark:hover:bg-moss-800"
      >
        {t('account.logout')}
      </button>
    </>
  )
}

/** Desktop sidebar footer: identity button opening the account menu. */
function SidebarAccount({ user, onLogout }: { user: UserResponse; onLogout: () => void }) {
  const { t } = useTranslation('shell')
  const [open, setOpen] = useState(false)

  return (
    <div className="relative mt-auto border-t border-moss-200 pt-3 dark:border-moss-750">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('account.label')}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-moss-100 dark:hover:bg-moss-800"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine-600 text-sm font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950">
          {(user.displayName || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.displayName}</span>
          <span className="block truncate text-xs text-moss-500 dark:text-moss-400">{user.email}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute inset-x-0 bottom-full z-50 mb-2 rounded-xl border border-moss-200 bg-moss-25 p-2 shadow-lg dark:border-moss-750 dark:bg-moss-850"
          >
            <AccountMenuItems
              showAdmin={user.role === 'ADMIN'}
              onNavigate={() => setOpen(false)}
              onLogout={onLogout}
            />
          </div>
        </>
      )}
    </div>
  )
}

/** Mobile bottom bar: the daily destinations, plus a Profil tab that opens
 *  the account sheet — identity, remaining destinations, theme and logout. */
function TabBar({ user, onLogout }: { user: UserResponse; onLogout: () => void }) {
  const { t } = useTranslation('shell')
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tabs = visibleNav(user.gymEnabled).filter((item) => item.to && item.mobileTab)
  const extraNav = visibleNav(user.gymEnabled).filter((item) => item.to && !item.mobileTab)
  const accountActive =
    menuOpen || pathname.startsWith('/profil') || pathname.startsWith('/parametres')

  return (
    <>
      <nav className={`fixed inset-x-0 bottom-0 z-40 grid ${tabs.length === 3 ? 'grid-cols-4' : 'grid-cols-5'} border-t border-moss-200 bg-moss-25/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-moss-750 dark:bg-moss-850/95`}>
        {tabs.map((item) => (
          <Link
            key={item.label}
            to={item.to!}
            activeOptions={{ exact: item.to === '/' }}
            className="flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[10px] font-medium text-moss-500 transition dark:text-moss-400 [&.active]:text-pine-700 dark:[&.active]:text-pine-300 [&.active_.tab-pill]:bg-pine-100 dark:[&.active_.tab-pill]:bg-pine-900"
          >
            <span className="tab-pill grid h-7 w-12 place-items-center rounded-full transition">
              {item.icon && <item.icon className="h-5.5 w-5.5" />}
            </span>
            {t(item.label)}
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[10px] font-medium transition ${
            accountActive ? 'text-pine-700 dark:text-pine-300' : 'text-moss-500 dark:text-moss-400'
          }`}
        >
          <span
            className={`tab-pill grid h-7 w-12 place-items-center rounded-full transition ${
              accountActive ? 'bg-pine-100 dark:bg-pine-900' : ''
            }`}
          >
            <span className="grid h-5.5 w-5.5 place-items-center rounded-full bg-pine-600 text-[10px] font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950">
              {(user.displayName || user.email).charAt(0).toUpperCase()}
            </span>
          </span>
          {t('account.tab')}
        </button>
      </nav>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-moss-950/50 md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-moss-200 bg-moss-25 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden dark:border-moss-750 dark:bg-moss-850"
          >
            <div className="border-b border-moss-200 px-3 pt-1 pb-2.5 dark:border-moss-750">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="truncate text-xs text-moss-500 dark:text-moss-400">{user.email}</p>
            </div>
            <div className="mt-1">
              <AccountMenuItems
                extraNav={extraNav}
                showAdmin={user.role === 'ADMIN'}
                onNavigate={() => setMenuOpen(false)}
                onLogout={onLogout}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ── App shell ─────────────────────────────────────────────────────── */

/** Persistent notice while signed into a throwaway demo sandbox. */
function DemoBanner({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation('shell')
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-copper-600/30 bg-copper-600/10 px-4 py-2 text-sm text-copper-600 md:px-8 dark:border-copper-300/30 dark:bg-copper-300/10 dark:text-copper-300">
      <span className="min-w-0 flex-1">{t('demo.banner')}</span>
      <button onClick={onExit} className="shrink-0 font-semibold underline underline-offset-2">
        {t('demo.exit')}
      </button>
    </div>
  )
}

/** Paths reachable while signed out. Every other route requires a session. */
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/auth/strava'])

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('shell')
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  // Session still restoring: render neither chrome. Mounting pages now and
  // remounting them once the user arrives would run mount effects twice —
  // the Strava OAuth banner consumes its ?strava=… query on first mount.
  if (user === undefined) {
    return <p className="mt-16 text-center text-moss-500 dark:text-moss-400">{t('common:loading')}</p>
  }

  if (!user) {
    // Signed out: only public routes render — any protected page (parametres,
    // profil, objectif, admin, …) sends the visitor to login instead of
    // exposing its shell.
    if (!PUBLIC_PATHS.has(pathname)) {
      return <Navigate to="/login" />
    }
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
                {t('public.signIn')}
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-pine-600 px-3.5 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
              >
                {t('public.createAccount')}
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
      </div>
    )
  }

  // Signed in but not yet activated (or since deactivated): the whole app is
  // off-limits — the account gate on the API refuses every call anyway. Show
  // the approval screen instead of any requested route.
  if (user.accountStatus !== 'ACTIVE') {
    return (
      <div className="min-h-screen">
        <header className="border-b border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <span className="flex items-center gap-2 font-display text-xl font-semibold text-pine-700 dark:text-pine-300">
              <LogoMark className="h-4 w-auto" />
              Cavale
            </span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16">
          <PendingApprovalPage status={user.accountStatus} email={user.email} />
        </main>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  // Signed-in chrome: sidebar (desktop) + bottom tabs (mobile) — no header;
  // identity, theme and logout live in the account menu.
  return (
    <div className="min-h-screen md:flex">
      {/* sticky: the account footer stays reachable on long pages */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-moss-200 bg-moss-25 p-4 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto dark:border-moss-750 dark:bg-moss-850">
        <Link
          to="/"
          className="mb-6 flex items-center gap-2.5 px-3 font-display text-2xl font-semibold text-pine-700 dark:text-pine-300"
        >
          <LogoMark className="h-5 w-auto" />
          Cavale
        </Link>
        <nav className="flex flex-col gap-1">
          <SidebarLinks gymEnabled={user.gymEnabled} />
        </nav>
        <SidebarAccount user={user} onLogout={handleLogout} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {user.demo && <DemoBanner onExit={handleLogout} />}
        <main className="flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">{children}</main>
        <TabBar user={user} onLogout={handleLogout} />
      </div>
    </div>
  )
}

/* ── Pages ─────────────────────────────────────────────────────────── */

function Home() {
  const { user } = useAuth()
  const { t } = useTranslation('shell')

  // Shell already renders a loading state (and no Outlet) while the session is
  // restoring, so Home only mounts once `user` is resolved (a value or null).
  if (user) {
    return <HomePage />
  }

  return (
    <div className="mt-20 text-center">
      <h1 className="font-display text-5xl font-semibold text-balance">
        Cavale <span className="text-pine-600 dark:text-pine-350">/ka.val/</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-moss-500 dark:text-moss-400">
        {t('public.tagline')}
      </p>
      <div className="mx-auto mt-10 flex max-w-xs flex-col items-center gap-3">
        <Link
          to="/register"
          className="w-full rounded-lg bg-pine-600 px-6 py-3 font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {t('public.cta')}
        </Link>
        <div className="w-full">
          <DemoButton />
        </div>
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
  path: '/planning',
  component: CalendarPage,
  validateSearch: (search: Record<string, unknown>): { week?: string } =>
    typeof search.week === 'string' ? { week: search.week } : {},
})

// Legacy URL kept alive for old bookmarks and external links.
const legacyCalendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendrier',
  validateSearch: (search: Record<string, unknown>): { week?: string } =>
    typeof search.week === 'string' ? { week: search.week } : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/planning', search })
  },
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

const workoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrainement/$workoutId',
  component: WorkoutPage,
})

// the old gym-stats URL now lives inside the unified statistics page
const gymStatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/renfo/stats',
  beforeLoad: () => {
    throw redirect({ to: '/stats', search: { tab: 'renfo' } })
  },
})

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsPage,
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search.tab === 'string' ? { tab: search.tab } : {},
})

const activitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activites',
  component: ActivitiesPage,
})

const activityDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activite/$activityId',
  component: ActivityDetailPage,
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

// Legacy URL — Strava/MCP live in Paramètres now; keep the OAuth query intact.
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  validateSearch: (search: Record<string, unknown>): { strava?: string } =>
    typeof search.strava === 'string' ? { strava: search.strava } : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/parametres', search })
  },
})

const profilRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profil',
  component: ProfilePage,
})

const parametresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parametres',
  component: ParametersPage,
  validateSearch: (search: Record<string, unknown>): { strava?: string } =>
    typeof search.strava === 'string' ? { strava: search.strava } : {},
})

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bienvenue',
  component: OnboardingPage,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: UsersAdminPage,
  validateSearch: (search: Record<string, unknown>): { status?: string } =>
    typeof search.status === 'string' ? { status: search.status } : {},
})

const stravaCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/strava',
  component: StravaCallbackPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  legacyCalendarRoute,
  sessionRoute,
  objectiveRoute,
  renfoRoute,
  exercisesRoute,
  templateEditorRoute,
  workoutRoute,
  gymStatsRoute,
  statsRoute,
  activitiesRoute,
  activityDetailRoute,
  registerRoute,
  loginRoute,
  settingsRoute,
  profilRoute,
  parametresRoute,
  onboardingRoute,
  adminRoute,
  stravaCallbackRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
