import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { RegisterPage } from './features/auth/RegisterPage'

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-slate-900">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight text-cavale-400">
            Cavale
          </Link>
          <Link
            to="/register"
            className="text-sm text-slate-300 transition hover:text-white [&.active]:text-white"
          >
            Register
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Outlet />
      </main>
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div className="mt-16 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
        Cavale <span className="text-cavale-500">/ka.val/</span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">
        Training companion for ultra-trail running — plans, strength work, and
        progress, all in one place.
      </p>
    </div>
  ),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
})

const routeTree = rootRoute.addChildren([indexRoute, registerRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
