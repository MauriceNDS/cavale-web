import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AuthCard, ErrorAlert, Field, SubmitButton } from '../../components/form'
import { ApiError } from '../../lib/api'
import { fetchDevLoginEnabled } from './api'
import { DemoButton } from './DemoButton'
import { StravaButton } from './StravaButton'
import { useAuth } from './session'

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loginSchema = z.object({
    email: z.email(t('login.errors.emailInvalid')),
    password: z.string().min(1, t('login.errors.passwordRequired')),
  })

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
    <AuthCard title={t('login.title')} subtitle={t('login.subtitle')}>
      {serverProblem && <ErrorAlert message={serverProblem.detail ?? serverProblem.title} />}

      <div className="mt-6">
        <StravaButton />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <Field label={t('login.email')} name="email" type="email" autoComplete="email" error={fieldErrors.email} />
        <Field
          label={t('login.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <SubmitButton pending={mutation.isPending} pendingText={t('login.submitting')}>
          {t('login.submit')}
        </SubmitButton>
      </form>

      <div className="mt-6 flex items-center gap-3 text-xs text-moss-400 dark:text-moss-500">
        <span className="h-px flex-1 bg-moss-200 dark:bg-moss-750" />
        {t('demo.orDemo')}
        <span className="h-px flex-1 bg-moss-200 dark:bg-moss-750" />
      </div>
      <div className="mt-4">
        <DemoButton />
      </div>

      <DevLoginSection />

      <p className="mt-4 text-center text-sm text-moss-500 dark:text-moss-400">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-pine-700 hover:underline dark:text-pine-300">
          {t('login.createOne')}
        </Link>
      </p>
    </AuthCard>
  )
}

/**
 * Passwordless email door, rendered only when the API says the deployment
 * has it open (the Strava-less dev environment). Invisible in production.
 */
function DevLoginSection() {
  const { t } = useTranslation('auth')
  const { loginWithDevEmail } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const enabled = useQuery({
    queryKey: ['dev-login-enabled'],
    queryFn: fetchDevLoginEnabled,
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: loginWithDevEmail,
    onSuccess: () => navigate({ to: '/' }),
  })

  if (!enabled.data?.enabled) return null

  const serverProblem = mutation.error instanceof ApiError ? mutation.error.problem : undefined

  return (
    <div className="mt-6 rounded-lg border border-dashed border-copper-600/50 p-3 dark:border-copper-300/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-copper-600 dark:text-copper-300">
        {t('devLogin.title')}
      </p>
      {serverProblem && <ErrorAlert message={serverProblem.detail ?? serverProblem.title} />}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (email.trim()) mutation.mutate(email.trim())
        }}
        className="mt-2 flex gap-2"
      >
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('devLogin.emailPlaceholder')}
          aria-label={t('devLogin.emailPlaceholder')}
          autoComplete="email"
          className="flex-1 rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm text-ink placeholder:text-moss-400 focus:outline-2 focus:outline-pine-600 dark:border-moss-750 dark:bg-moss-800 dark:text-linen dark:placeholder:text-moss-500 dark:focus:outline-pine-350"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !email.trim()}
          className="rounded-lg border border-copper-600/50 px-3 py-2 text-sm font-medium text-copper-600 transition hover:bg-copper-600/10 disabled:opacity-50 dark:border-copper-300/40 dark:text-copper-300"
        >
          {mutation.isPending ? t('devLogin.submitting') : t('devLogin.submit')}
        </button>
      </form>
    </div>
  )
}
