import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AuthCard, ErrorAlert, Field, SubmitButton } from '../../components/form'
import { ApiError } from '../../lib/api'
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

      <p className="mt-4 text-center text-sm text-moss-500 dark:text-moss-400">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-pine-700 hover:underline dark:text-pine-300">
          {t('login.createOne')}
        </Link>
      </p>
    </AuthCard>
  )
}
