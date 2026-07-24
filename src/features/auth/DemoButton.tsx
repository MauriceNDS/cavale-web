import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { useAuth } from './session'

/**
 * "Explore the live demo" — one click spins up a throwaway, fully-seeded
 * sandbox and drops the visitor straight into the app. For recruiters.
 */
export function DemoButton({ className }: { className?: string }) {
  const { t } = useTranslation('auth')
  const { loginWithDemo } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    try {
      await loginWithDemo()
      await navigate({ to: '/' })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('demo.error'))
      setPending(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={
          className ??
          'w-full rounded-lg border border-pine-600 px-4 py-2.5 font-semibold text-pine-700 transition hover:bg-pine-100 disabled:opacity-50 dark:border-pine-350 dark:text-pine-300 dark:hover:bg-pine-900'
        }
      >
        {pending ? t('demo.starting') : t('demo.cta')}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {error}
        </p>
      )}
    </div>
  )
}
