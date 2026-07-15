import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { setToken } from '../../lib/api'
import { fetchMe } from './api'

/** Landing point of the Strava login redirect: #token=… or #error. */
export function StravaCallbackPage() {
  const { t } = useTranslation('auth')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const token = fragment.get('token')
    if (token) {
      setToken(token)
      // Full reload so the session restores through /users/me;
      // a blank profile means a first Strava-born visit → onboarding
      fetchMe()
        .then((me) => window.location.replace(me.weightKg == null ? '/bienvenue' : '/'))
        .catch(() => window.location.replace('/'))
    } else {
      setFailed(true)
    }
  }, [])

  if (!failed) {
    return <p className="mt-16 text-center text-moss-500 dark:text-moss-400">{t('stravaCallback.connecting')}</p>
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-moss-200 bg-moss-25 p-8 text-center dark:border-moss-750 dark:bg-moss-850">
      <h1 className="font-display text-xl font-semibold">{t('stravaCallback.cancelledTitle')}</h1>
      <p className="mt-2 text-sm text-moss-500 dark:text-moss-400">{t('stravaCallback.cancelledBody')}</p>
      <Link
        to="/login"
        className="mt-5 inline-block rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {t('stravaCallback.backToLogin')}
      </Link>
    </div>
  )
}
