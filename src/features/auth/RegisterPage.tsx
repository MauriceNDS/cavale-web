import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthCard, ErrorAlert, Field, SubmitButton } from '../../components/form'
import { ApiError } from '../../lib/api'
import { registerUser, type RegisterRequest } from './api'
import { useAuth } from './session'

const registerSchema = z.object({
  email: z.email('Adresse email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères').max(72, 'Au plus 72 caractères'),
  displayName: z.string().trim().min(1, 'Le nom est requis').max(100),
})

type FieldErrors = Partial<Record<'email' | 'password' | 'displayName', string>>

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: async (request: RegisterRequest) => {
      await registerUser(request)
      // Auto-login right after registration for a seamless first run
      return login(request.email, request.password)
    },
    onSuccess: () => navigate({ to: '/' }),
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
    <AuthCard title="Créer un compte" subtitle="Cours libre. Entraîne-toi avec intention.">
      {serverProblem && <ErrorAlert message={serverProblem.detail ?? serverProblem.title} />}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email ?? serverProblem?.errors?.email}
        />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password ?? serverProblem?.errors?.password}
        />
        <Field
          label="Nom affiché"
          name="displayName"
          type="text"
          autoComplete="nickname"
          error={fieldErrors.displayName ?? serverProblem?.errors?.displayName}
        />
        <SubmitButton pending={mutation.isPending} pendingText="Création…">
          Créer mon compte
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-moss-500 dark:text-moss-400">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-pine-700 hover:underline dark:text-pine-300">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  )
}
