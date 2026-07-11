import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../lib/api'
import { updateProfile } from '../athlete/api'
import { fetchMe } from '../auth/api'
import { disconnectStrava, fetchAuthorizeUrl, fetchStravaStatus } from '../strava/api'

export function SettingsPage() {
  const [banner, setBanner] = useState<'connected' | 'error' | null>(null)

  // Result of the OAuth round-trip (backend redirects here with ?strava=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get('strava')
    if (outcome === 'connected' || outcome === 'error') {
      setBanner(outcome)
      window.history.replaceState(null, '', '/settings')
    }
  }, [])

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <h1 className="font-display text-2xl font-semibold">Réglages</h1>

      {banner === 'connected' && (
        <div role="status" className="mt-4 rounded-lg bg-pine-100 p-3 text-sm text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          Strava est connecté. Valide tes séances depuis le calendrier : « Importer depuis Strava ».
        </div>
      )}
      {banner === 'error' && (
        <div role="alert" className="mt-4 rounded-lg bg-clay-100 p-3 text-sm text-clay-600 dark:bg-clay-900 dark:text-clay-300">
          La connexion Strava a échoué. Réessaie.
        </div>
      )}

      <ProfileCard />
      <StravaCard />
    </div>
  )
}

function ProfileCard() {
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['hub'] })
    },
  })

  const user = me.data
  const fieldClass =
    'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">Profil athlète</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">
        Ces données alimentent la page d'accueil et, plus tard, les zones d'entraînement.
      </p>

      {me.isLoading && <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">Chargement…</p>}

      {user && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            setSaved(false)
            const data = new FormData(event.currentTarget)
            const num = (name: string) => {
              const value = (data.get(name) as string | null)?.trim().replace(',', '.')
              return value ? Number(value) : null
            }
            mutation.mutate({
              displayName: (data.get('displayName') as string).trim(),
              weightKg: num('weightKg'),
              heightCm: num('heightCm'),
              birthDate: ((data.get('birthDate') as string) || '').trim() || null,
              maxHr: num('maxHr'),
              restingHr: num('restingHr'),
            })
          }}
        >
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Nom affiché</span>
            <input name="displayName" required maxLength={100} defaultValue={user.displayName} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Poids (kg)</span>
            <input name="weightKg" type="number" step="0.1" min="0" defaultValue={user.weightKg ?? ''} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Taille (cm)</span>
            <input name="heightCm" type="number" min="0" defaultValue={user.heightCm ?? ''} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Date de naissance</span>
            <input name="birthDate" type="date" defaultValue={user.birthDate ?? ''} className={fieldClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">FC max</span>
              <input name="maxHr" type="number" min="0" defaultValue={user.maxHr ?? ''} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">FC repos</span>
              <input name="restingHr" type="number" min="0" defaultValue={user.restingHr ?? ''} className={fieldClass} />
            </label>
          </div>
          {mutation.error instanceof ApiError && (
            <p role="alert" className="text-sm text-clay-500 sm:col-span-2 dark:text-clay-300">
              {mutation.error.message}
            </p>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saved && (
              <span role="status" className="text-sm text-pine-700 dark:text-pine-300">
                Profil enregistré ✓
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

function StravaCard() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ['strava-status'], queryFn: fetchStravaStatus })

  const connect = useMutation({
    mutationFn: fetchAuthorizeUrl,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const disconnect = useMutation({
    mutationFn: disconnectStrava,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strava-status'] }),
  })

  const data = status.data

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Strava</h2>
          <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">
            Une fois connecté, chaque séance du calendrier propose « Importer depuis Strava ».
          </p>
        </div>
        {data?.connected && (
          <span className="rounded-full bg-pine-100 px-2.5 py-0.5 text-xs font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
            Connecté
          </span>
        )}
      </div>

      {status.isLoading && <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">Chargement…</p>}

      {data && !data.configured && (
        <div className="mt-4 rounded-lg bg-moss-100 p-3 text-sm text-moss-500 dark:bg-moss-800 dark:text-moss-400">
          <p className="font-medium text-ink dark:text-linen">Configuration requise (une fois)</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>
              Crée une application API sur{' '}
              <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="text-pine-700 underline dark:text-pine-300">
                strava.com/settings/api
              </a>{' '}
              (domaine d'autorisation : <code>localhost</code>)
            </li>
            <li>
              Renseigne <code>CAVALE_STRAVA_CLIENT_ID</code> et <code>CAVALE_STRAVA_CLIENT_SECRET</code>{' '}
              (fichier <code>api/.env</code>), puis redémarre l'API
            </li>
          </ol>
        </div>
      )}

      {data?.configured && !data.connected && (
        <button
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="mt-4 rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502] disabled:opacity-50"
        >
          {connect.isPending ? 'Redirection…' : 'Connecter Strava'}
        </button>
      )}

      {data?.connected && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-moss-500 tabular-nums dark:text-moss-400">Athlète #{data.athleteId}</p>
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
          >
            Déconnecter
          </button>
        </div>
      )}
    </section>
  )
}
