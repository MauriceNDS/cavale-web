import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../../lib/api'

/** "Continuer avec Strava" — one click: sign in, or sign up + connect at once. */
export function StravaButton() {
  const { t } = useTranslation('auth')
  const [pending, setPending] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setErrorKey(null)
    try {
      const { url } = await api.get<{ url: string }>('/api/auth/strava/login-url')
      window.location.href = url
    } catch (e) {
      setPending(false)
      setErrorKey(
        e instanceof ApiError && e.status === 409 ? 'strava.notConfigured' : 'strava.unavailable',
      )
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="w-full rounded-lg bg-[#fc4c02] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e04502] disabled:opacity-50"
      >
        {pending ? t('strava.redirecting') : t('strava.continue')}
      </button>
      {errorKey && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {t(errorKey)}
        </p>
      )}
      <div className="mt-4 mb-0 flex items-center gap-3 text-xs text-moss-400 dark:text-moss-500">
        <span className="h-px flex-1 bg-moss-200 dark:bg-moss-750" />
        {t('strava.orEmail')}
        <span className="h-px flex-1 bg-moss-200 dark:bg-moss-750" />
      </div>
    </div>
  )
}
