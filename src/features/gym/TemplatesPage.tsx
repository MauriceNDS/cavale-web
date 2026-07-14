import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ApiError } from '../../lib/api'
import { RenfoTabs } from './RenfoTabs'
import { createTemplate, fetchTemplates } from './api'

const muted = 'text-moss-500 dark:text-moss-400'
const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

/** Strength programs — each card is a template with its A/B/C variants. */
export function TemplatesPage() {
  const [creating, setCreating] = useState(false)
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['gym-templates'], queryFn: fetchTemplates })

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gym-templates'] })
      setCreating(false)
    },
  })

  const templates = (query.data ?? []).filter((t) => !t.archived)

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RenfoTabs active="programmes" />
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          + Nouveau programme
        </button>
      </div>

      {creating && (
        <form
          className="mt-4 space-y-3 rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            createMutation.mutate({
              name: (data.get('name') as string).trim(),
              goal: ((data.get('goal') as string) || '').trim() || undefined,
            })
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Nom du programme</span>
            <input name="name" required maxLength={150} placeholder="Force Max" className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Objectif</span>
            <input
              name="goal"
              placeholder="Cycle force de l'hiver — squat, soulevé, fentes"
              className={fieldClass}
            />
          </label>
          {createMutation.error instanceof ApiError && (
            <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
              {createMutation.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className={`px-3 py-2 text-sm font-medium ${muted}`}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {query.isLoading && <p className={`mt-8 text-center ${muted}`}>Chargement…</p>}
      {query.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          Impossible de charger les programmes.
        </p>
      )}
      {query.data && templates.length === 0 && !creating && (
        <p className={`mt-8 text-center ${muted}`}>
          Aucun programme — crée « Force Max » pour commencer.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <Link
            key={template.id}
            to="/renfo/programmes/$templateId"
            params={{ templateId: template.id }}
            className="rounded-xl border border-moss-200 bg-moss-25 p-4 transition hover:border-copper-600/50 dark:border-moss-750 dark:bg-moss-850 dark:hover:border-copper-300/50"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold">{template.name}</p>
              <div className="flex gap-1">
                {template.variants.map((variant) => (
                  <span
                    key={variant.id}
                    className="grid h-6 w-6 place-items-center rounded-full bg-copper-600/15 text-xs font-semibold text-copper-600 dark:bg-copper-300/15 dark:text-copper-300"
                  >
                    {variant.label}
                  </span>
                ))}
              </div>
            </div>
            {template.goal && <p className={`mt-1 text-sm ${muted}`}>{template.goal}</p>}
            <p className={`mt-2 text-xs ${muted}`}>
              {template.variants.reduce((sum, v) => sum + v.exerciseCount, 0)} exercice(s) au total
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
