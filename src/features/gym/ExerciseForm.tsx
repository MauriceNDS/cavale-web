import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../lib/api'
import {
  createExercise,
  updateExercise,
  type ExerciseCategory,
  type ExerciseRequest,
  type ExerciseResponse,
  type Equipment,
  type ExerciseMeasure,
  type Muscle,
} from './api'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  EQUIPMENTS,
  EQUIPMENT_LABEL,
  MEASURES,
  MEASURE_LABEL,
  MUSCLES,
  MUSCLE_LABEL,
} from './labels'

const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

/**
 * Create / edit / derive an exercise. Deriving prefills everything from the
 * parent and links the new exercise to it.
 */
export function ExerciseForm({
  exercise,
  deriveFrom,
  initialName,
  onSaved,
  onCancel,
}: {
  exercise?: ExerciseResponse
  deriveFrom?: ExerciseResponse
  initialName?: string
  onSaved: (saved: ExerciseResponse) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const base = exercise ?? deriveFrom
  const [muscles, setMuscles] = useState<Muscle[]>(base?.muscles ?? [])

  const mutation = useMutation({
    mutationFn: (body: ExerciseRequest) =>
      exercise ? updateExercise(exercise.id, body) : createExercise(body),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onSaved(saved)
    },
  })

  function toggleMuscle(muscle: Muscle) {
    setMuscles((current) =>
      current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle],
    )
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        mutation.mutate({
          name: (data.get('name') as string).trim(),
          category: data.get('category') as ExerciseCategory,
          equipment: data.get('equipment') as Equipment,
          measure: data.get('measure') as ExerciseMeasure,
          description: ((data.get('description') as string) || '').trim() || undefined,
          resourceUrl: ((data.get('resourceUrl') as string) || '').trim() || undefined,
          runningBenefit: ((data.get('runningBenefit') as string) || '').trim() || undefined,
          muscles,
          derivedFromId: deriveFrom?.id,
          archived: exercise?.archived,
        })
      }}
    >
      <p className="text-sm font-semibold">
        {exercise
          ? `Modifier « ${exercise.name} »`
          : deriveFrom
            ? `Dériver de « ${deriveFrom.name} »`
            : 'Nouvel exercice'}
      </p>

      <label className="block">
        <span className="text-sm font-medium">Nom</span>
        <input
          name="name"
          required
          maxLength={150}
          defaultValue={exercise?.name ?? initialName ?? (deriveFrom ? `${deriveFrom.name} — ` : '')}
          placeholder="Squat excentrique lent"
          className={fieldClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium">Catégorie</span>
          <select name="category" defaultValue={base?.category ?? 'FORCE'} className={fieldClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Matériel</span>
          <select name="equipment" defaultValue={base?.equipment ?? 'BARBELL'} className={fieldClass}>
            {EQUIPMENTS.map((e) => (
              <option key={e} value={e}>
                {EQUIPMENT_LABEL[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Mesure</span>
          <select name="measure" defaultValue={base?.measure ?? 'WEIGHT_REPS'} className={fieldClass}>
            {MEASURES.map((m) => (
              <option key={m} value={m}>
                {MEASURE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="text-sm font-medium">Muscles ciblés</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MUSCLES.map((muscle) => (
            <button
              key={muscle}
              type="button"
              onClick={() => toggleMuscle(muscle)}
              aria-pressed={muscles.includes(muscle)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                muscles.includes(muscle)
                  ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                  : 'bg-moss-100 text-moss-500 hover:text-ink dark:bg-moss-800 dark:text-moss-400 dark:hover:text-linen'
              }`}
            >
              {MUSCLE_LABEL[muscle]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Comment l'exécuter</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={base?.description ?? ''}
          placeholder="Position, tempo, consignes de sécurité…"
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Ressource (vidéo, article)</span>
        <input
          name="resourceUrl"
          type="url"
          maxLength={500}
          defaultValue={base?.resourceUrl ?? ''}
          placeholder="https://youtube.com/…"
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Pourquoi pour le trail</span>
        <textarea
          name="runningBenefit"
          rows={2}
          defaultValue={base?.runningBenefit ?? ''}
          placeholder="Force excentrique pour encaisser les descentes…"
          className={fieldClass}
        />
      </label>

      {mutation.error instanceof ApiError && (
        <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm font-medium text-moss-500 dark:text-moss-400"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
