import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError } from '../../lib/api'
import { updateProfile } from '../athlete/api'
import { useAuth } from './session'

const muted = 'text-moss-500 dark:text-moss-400'
const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

/**
 * First-run onboarding: the athlete profile (everything the stats need)
 * and what Cavale is used for. Skippable — everything stays editable in
 * the profile page.
 */
export function OnboardingPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [gym, setGym] = useState(true)

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await refresh()
      void navigate({ to: '/' })
    },
  })

  if (!user) {
    return <p className={`mt-16 text-center ${muted}`}>Chargement…</p>
  }

  return (
    <div className="mx-auto mt-8 max-w-lg pb-16">
      <h1 className="font-display text-3xl font-semibold">Bienvenue sur Cavale 🏔</h1>
      <p className={`mt-2 ${muted}`}>
        Deux minutes pour personnaliser ton entraînement — tout reste modifiable dans ton
        profil.
      </p>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const num = (key: string) => {
            const raw = (data.get(key) as string) || ''
            return raw ? Number(raw) : null
          }
          mutation.mutate({
            displayName: ((data.get('displayName') as string) || user.displayName).trim(),
            weightKg: num('weightKg'),
            heightCm: num('heightCm'),
            birthDate: ((data.get('birthDate') as string) || '') || null,
            maxHr: num('maxHr'),
            restingHr: num('restingHr'),
            gymEnabled: gym,
          })
        }}
      >
        <section className="rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850">
          <h2 className="font-display text-lg font-semibold">Ton profil d'athlète</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Poids, FC et date de naissance nourrissent les statistiques et l'estimation
            d'effort.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-sm font-medium">
              Nom affiché
              <input name="displayName" defaultValue={user.displayName} maxLength={100} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              Poids (kg)
              <input name="weightKg" type="number" step="0.1" min="30" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              Taille (cm)
              <input name="heightCm" type="number" min="100" className={fieldClass} />
            </label>
            <label className="col-span-2 block text-sm font-medium">
              Date de naissance
              <input name="birthDate" type="date" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              FC max
              <input name="maxHr" type="number" min="100" max="240" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              FC repos
              <input name="restingHr" type="number" min="25" max="120" className={fieldClass} />
            </label>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Tu utilises Cavale pour…</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <UsageCard
              selected={!gym}
              onSelect={() => setGym(false)}
              emoji="🏃"
              title="La course uniquement"
              description="Plans, calendrier, Strava et statistiques. Le renfo reste activable plus tard dans les paramètres."
            />
            <UsageCard
              selected={gym}
              onSelect={() => setGym(true)}
              emoji="🏔"
              title="Course + renfo"
              description="Tout, plus les programmes de force, le suivi des séances en salle et leurs statistiques."
            />
          </div>
        </section>

        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-pine-600 px-5 py-2.5 font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {mutation.isPending ? 'Enregistrement…' : "C'est parti"}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/' })}
            className={`text-sm font-medium ${muted} hover:underline`}
          >
            Plus tard
          </button>
        </div>
      </form>
    </div>
  )
}

function UsageCard({
  selected,
  onSelect,
  emoji,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  emoji: string
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-pine-600 bg-pine-100/50 ring-1 ring-pine-600 dark:border-pine-350 dark:bg-pine-900/40 dark:ring-pine-350'
          : 'border-moss-200 bg-moss-25 hover:border-pine-600/50 dark:border-moss-750 dark:bg-moss-850 dark:hover:border-pine-350/50'
      }`}
    >
      <p className="text-xl">{emoji}</p>
      <p className="mt-1 font-semibold">{title}</p>
      <p className="mt-1 text-xs text-moss-500 dark:text-moss-400">{description}</p>
    </button>
  )
}
