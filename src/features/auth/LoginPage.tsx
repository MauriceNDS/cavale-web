import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useAuth } from './session'
import { ApiError } from '../../lib/api'

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: () => navigate({ to: '/' }),
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = loginSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    )

    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    mutation.mutate(parsed.data)
  }

  const serverProblem = mutation.error instanceof ApiError ? mutation.error.problem : undefined

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-8 shadow">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back to the trails.</p>

      {serverProblem && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverProblem.detail ?? serverProblem.title}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-cavale-500 focus:outline-none focus:ring-2 focus:ring-cavale-400/40"
          />
          {fieldErrors.email && (
            <span className="mt-1 block text-sm text-red-600">{fieldErrors.email}</span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!fieldErrors.password}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-cavale-500 focus:outline-none focus:ring-2 focus:ring-cavale-400/40"
          />
          {fieldErrors.password && (
            <span className="mt-1 block text-sm text-red-600">{fieldErrors.password}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-cavale-500 px-4 py-2.5 font-semibold text-white transition hover:bg-cavale-600 disabled:opacity-50"
        >
          {mutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-cavale-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}
