import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AuthCard, ErrorAlert, Field, SubmitButton } from '../../components/form'
import { ApiError } from '../../lib/api'
import { registerUser, type RegisterRequest } from './api'
import { DemoButton } from './DemoButton'
import { StravaButton } from './StravaButton'
import { useAuth } from './session'

type FieldErrors = Partial<Record<'email' | 'password' | 'displayName', string>>

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const registerSchema = z.object({
    email: z.email(t('register.errors.emailInvalid')),
    password: z
      .string()
      .min(8, t('register.errors.passwordMin'))
      .max(72, t('register.errors.passwordMax')),
    displayName: z.string().trim().min(1, t('register.errors.nameRequired')).max(100),
  })

  const mutation = useMutation({
    mutationFn: async (request: RegisterRequest) => {
      await registerUser(request)
      // Auto-login right after registration for a seamless first run
      return login(request.email, request.password)
    },
    // fresh account → onboarding: profile details + what Cavale is used for
    onSuccess: () => navigate({ to: '/bienvenue' }),
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = registerSchema.safeParse(
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
    <AuthCard title={t('register.title')} subtitle={t('register.subtitle')}>
      {serverProblem && <ErrorAlert message={serverProblem.detail ?? serverProblem.title} />}

      <div className="mt-6">
        <StravaButton />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <Field
          label={t('register.email')}
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email ?? serverProblem?.errors?.email}
        />
        <Field
          label={t('register.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password ?? serverProblem?.errors?.password}
        />
        <Field
          label={t('register.displayName')}
          name="displayName"
          type="text"
          autoComplete="nickname"
          error={fieldErrors.displayName ?? serverProblem?.errors?.displayName}
        />
        <SubmitButton pending={mutation.isPending} pendingText={t('common:creating')}>
          {t('register.submit')}
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

      <p className="mt-4 text-center text-sm text-moss-500 dark:text-moss-400">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-pine-700 hover:underline dark:text-pine-300">
          {t('register.signIn')}
        </Link>
      </p>
    </AuthCard>
  )
}
