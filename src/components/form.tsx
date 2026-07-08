import type { ReactNode } from 'react'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-moss-200 bg-moss-25 p-8 dark:border-moss-750 dark:bg-moss-850">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-moss-500 dark:text-moss-400">{subtitle}</p>
      {children}
    </div>
  )
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-lg border border-clay-300/50 bg-clay-100 p-3 text-sm text-clay-600 dark:border-clay-600/50 dark:bg-clay-900 dark:text-clay-300"
    >
      {message}
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  type: string
  autoComplete?: string
  error?: string
}

export function Field({ label, name, type, autoComplete, error }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className="mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
      />
      {error && <span className="mt-1 block text-sm text-clay-500 dark:text-clay-300">{error}</span>}
    </label>
  )
}

export function SubmitButton({ pending, children, pendingText }: { pending: boolean; children: ReactNode; pendingText: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-pine-600 px-4 py-2.5 font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
    >
      {pending ? pendingText : children}
    </button>
  )
}
