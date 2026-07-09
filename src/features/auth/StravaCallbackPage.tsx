import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { setToken } from '../../lib/api'

/** Landing point of the Strava login redirect: #token=… or #error. */
export function StravaCallbackPage() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const token = fragment.get('token')
    if (token) {
      setToken(token)
      // Full reload so the session restores through /users/me
      window.location.replace('/')
    } else {
      setFailed(true)
    }
  }, [])

  if (!failed) {
    return <p className="mt-16 text-center text-moss-500 dark:text-moss-400">Connexion…</p>
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-moss-200 bg-moss-25 p-8 text-center dark:border-moss-750 dark:bg-moss-850">
      <h1 className="font-display text-xl font-semibold">Connexion Strava annulée</h1>
      <p className="mt-2 text-sm text-moss-500 dark:text-moss-400">
        L'autorisation n'a pas abouti. Tu peux réessayer ou te connecter par email.
      </p>
      <Link
        to="/login"
        className="mt-5 inline-block rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        Retour à la connexion
      </Link>
    </div>
  )
}
