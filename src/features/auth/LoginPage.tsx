import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthCard, ErrorAlert, Field, SubmitButton } from '../../components/form'
import { ApiError } from '../../lib/api'
import { useAuth } from './session'

const loginSchema = z.object({
  email: z.email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
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
    <AuthCard title="Se connecter" subtitle="Bon retour sur les sentiers.">
      {serverProblem && <ErrorAlert message={serverProblem.detail ?? serverProblem.title} />}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" error={fieldErrors.email} />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <SubmitButton pending={mutation.isPending} pendingText="Connexion…">
          Se connecter
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-moss-500 dark:text-moss-400">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-pine-700 hover:underline dark:text-pine-300">
          En créer un
        </Link>
      </p>
    </AuthCard>
  )
}
