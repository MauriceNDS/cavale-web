import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { registerUser, type RegisterRequest } from './api'
import { useAuth } from './session'
import { ApiError } from '../../lib/api'

const registerSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters'),
  displayName: z.string().trim().min(1, 'Display name is required').max(100),
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
    const formData = new FormData(event.currentTarget)
    const parsed = registerSchema.safeParse(Object.fromEntries(formData))

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
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Run free. Train with intent.</p>

      {serverProblem && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverProblem.detail ?? serverProblem.title}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" error={fieldErrors.email ?? serverProblem?.errors?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          error={fieldErrors.password ?? serverProblem?.errors?.password}
        />
        <Field
          label="Display name"
          name="displayName"
          type="text"
          error={fieldErrors.displayName ?? serverProblem?.errors?.displayName}
        />

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-cavale-500 px-4 py-2.5 font-semibold text-white transition hover:bg-cavale-600 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  type: string
  error?: string
}

function Field({ label, name, type, error }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        aria-invalid={!!error}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-cavale-500 focus:outline-none focus:ring-2 focus:ring-cavale-400/40"
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
