import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../lib/api'
import { RenfoTabs } from './RenfoTabs'
import { ExerciseForm } from './ExerciseForm'
import {
  deleteExercise,
  fetchExercises,
  updateExercise,
  type ExerciseCategory,
  type ExerciseResponse,
} from './api'
import {
  CATEGORIES,
  CATEGORY_BADGE,
  CATEGORY_EDGE,
  CATEGORY_LABEL,
  EQUIPMENT_LABEL,
  MEASURE_LABEL,
  MUSCLE_LABEL,
} from './labels'

const muted = 'text-moss-500 dark:text-moss-400'

type FormState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; exercise: ExerciseResponse }
  | { kind: 'derive'; parent: ExerciseResponse }

/** The library — every movement with its theory, colored by category. */
export function ExercisesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)
  const [form, setForm] = useState<FormState>({ kind: 'closed' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['exercises'], queryFn: fetchExercises })

  const exercises = (query.data ?? [])
    .filter((e) => !e.archived)
    .filter((e) => category == null || e.category === category)
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <RenfoTabs active="exercices" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un exercice…"
          aria-label="Rechercher un exercice"
          className="w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 sm:w-64 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
        />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              aria-pressed={category === c}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                category === c
                  ? CATEGORY_BADGE[c] + ' ring-1 ring-current'
                  : CATEGORY_BADGE[c] + ' opacity-60 hover:opacity-100'
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setForm({ kind: 'create' })}
          className="ml-auto rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          + Nouvel exercice
        </button>
      </div>

      {form.kind !== 'closed' && (
        <div className="mt-4">
          <ExerciseForm
            exercise={form.kind === 'edit' ? form.exercise : undefined}
            deriveFrom={form.kind === 'derive' ? form.parent : undefined}
            onSaved={() => setForm({ kind: 'closed' })}
            onCancel={() => setForm({ kind: 'closed' })}
          />
        </div>
      )}

      {query.isLoading && <p className={`mt-8 text-center ${muted}`}>Chargement…</p>}
      {query.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          Impossible de charger la bibliothèque.
        </p>
      )}
      {query.data && exercises.length === 0 && (
        <p className={`mt-8 text-center ${muted}`}>
          {query.data.filter((e) => !e.archived).length === 0
            ? 'Ta bibliothèque est vide — crée ton premier exercice.'
            : 'Aucun exercice ne correspond.'}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            expanded={expanded === exercise.id}
            onToggle={() => setExpanded(expanded === exercise.id ? null : exercise.id)}
            onEdit={() => setForm({ kind: 'edit', exercise })}
            onDerive={() => setForm({ kind: 'derive', parent: exercise })}
          />
        ))}
      </div>
    </div>
  )
}

function ExerciseCard({
  exercise,
  expanded,
  onToggle,
  onEdit,
  onDerive,
}: {
  exercise: ExerciseResponse
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDerive: () => void
}) {
  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: () =>
      updateExercise(exercise.id, {
        name: exercise.name,
        category: exercise.category,
        equipment: exercise.equipment,
        measure: exercise.measure,
        description: exercise.description ?? undefined,
        resourceUrl: exercise.resourceUrl ?? undefined,
        runningBenefit: exercise.runningBenefit ?? undefined,
        muscles: exercise.muscles,
        archived: true,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteExercise(exercise.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  })

  return (
    <div
      className={`rounded-lg border border-l-4 border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[exercise.category]}`}
    >
      <button onClick={onToggle} aria-expanded={expanded} className="w-full p-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{exercise.name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[exercise.category]}`}
          >
            {CATEGORY_LABEL[exercise.category]}
          </span>
          {exercise.derivedFromName && (
            <span className={`text-xs ${muted}`}>← {exercise.derivedFromName}</span>
          )}
        </div>
        <p className={`mt-0.5 text-xs ${muted}`}>
          {EQUIPMENT_LABEL[exercise.equipment]} · {MEASURE_LABEL[exercise.measure]}
          {exercise.muscles.length > 0 &&
            ` · ${exercise.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}`}
        </p>
      </button>

      {expanded && (
        <div className="border-t border-moss-200 p-3 text-sm dark:border-moss-750">
          {exercise.description && <p className="whitespace-pre-line">{exercise.description}</p>}
          {exercise.runningBenefit && (
            <p className={`mt-2 ${muted}`}>
              <span className="font-medium text-ink dark:text-linen">Pourquoi pour le trail : </span>
              {exercise.runningBenefit}
            </p>
          )}
          {exercise.resourceUrl && (
            <a
              href={exercise.resourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-medium text-pine-700 underline dark:text-pine-300"
            >
              Voir la ressource ↗
            </a>
          )}
          {!exercise.description && !exercise.runningBenefit && !exercise.resourceUrl && (
            <p className={muted}>Pas encore de fiche — ajoute la théorie en modifiant l'exercice.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton onClick={onEdit}>Modifier</ActionButton>
            <ActionButton onClick={onDerive}>Dériver</ActionButton>
            <ActionButton onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
              Archiver
            </ActionButton>
            <ActionButton
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              danger
            >
              Supprimer
            </ActionButton>
          </div>
          {deleteMutation.error instanceof ApiError && (
            <p role="alert" className="mt-2 text-xs text-clay-500 dark:text-clay-300">
              {deleteMutation.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        danger
          ? 'border-clay-500/40 text-clay-500 hover:bg-clay-100 dark:text-clay-300 dark:hover:bg-clay-900'
          : 'border-moss-200 hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800'
      }`}
    >
      {children}
    </button>
  )
}
