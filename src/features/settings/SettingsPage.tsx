import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  disconnectStrava,
  fetchAuthorizeUrl,
  fetchStravaStatus,
  syncStrava,
  type SyncResult,
} from '../strava/api'

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
          Strava est connecté. Lance une synchronisation pour importer tes sorties.
        </div>
      )}
      {banner === 'error' && (
        <div role="alert" className="mt-4 rounded-lg bg-clay-100 p-3 text-sm text-clay-600 dark:bg-clay-900 dark:text-clay-300">
          La connexion Strava a échoué. Réessaie.
        </div>
      )}

      <StravaCard />
    </div>
  )
}

function StravaCard() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ['strava-status'], queryFn: fetchStravaStatus })
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const connect = useMutation({
    mutationFn: fetchAuthorizeUrl,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const sync = useMutation({
    mutationFn: syncStrava,
    onSuccess: (result) => {
      setSyncResult(result)
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['strava-status'] })
    },
  })

  const disconnect = useMutation({
    mutationFn: disconnectStrava,
    onSuccess: () => {
      setSyncResult(null)
      queryClient.invalidateQueries({ queryKey: ['strava-status'] })
    },
  })

  const data = status.data

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Strava</h2>
          <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">
            Importe tes sorties et valide automatiquement les séances correspondantes.
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
              Exporte <code>CAVALE_STRAVA_CLIENT_ID</code> et <code>CAVALE_STRAVA_CLIENT_SECRET</code>,
              puis redémarre l'API
            </li>
          </ol>
        </div>
      )}

      {data?.configured && !data.connected && (
        <button
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="mt-4 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {connect.isPending ? 'Redirection…' : 'Connecter Strava'}
        </button>
      )}

      {data?.connected && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-moss-500 tabular-nums dark:text-moss-400">
            Athlète #{data.athleteId}
            {data.lastSyncAt &&
              ` · dernière synchro ${format(parseISO(data.lastSyncAt), "d MMM 'à' HH:mm", { locale: fr })}`}
          </p>

          {sync.isError && (
            <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
              La synchronisation a échoué. Réessaie dans quelques minutes.
            </p>
          )}
          {syncResult && (
            <p role="status" className="rounded-lg bg-pine-100/60 p-2.5 text-sm dark:bg-pine-900/40">
              {syncResult.matched} séance{syncResult.matched > 1 ? 's' : ''} validée
              {syncResult.matched > 1 ? 's' : ''} · {syncResult.alreadyImported} déjà importée
              {syncResult.alreadyImported > 1 ? 's' : ''} · {syncResult.unmatched} sortie
              {syncResult.unmatched > 1 ? 's' : ''} sans séance correspondante
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {sync.isPending ? 'Synchronisation…' : 'Synchroniser (30 derniers jours)'}
            </button>
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
            >
              Déconnecter
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
