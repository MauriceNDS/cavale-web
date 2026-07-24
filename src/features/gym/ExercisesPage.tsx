import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { muted } from '../../lib/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RenfoTabs } from './RenfoTabs'
import { ExerciseForm } from './ExerciseForm'
import {
  deleteExercise,
  fetchExercises,
  updateExercise,
  type Equipment,
  type ExerciseCategory,
  type ExerciseResponse,
  type Muscle,
} from './api'
import {
  CATEGORIES,
  CATEGORY_BADGE,
  CATEGORY_EDGE,
  categoryLabel,
  EQUIPMENTS,
  equipmentLabel,
  measureLabel,
  MUSCLES,
  muscleLabel,
} from './labels'

type FormState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; exercise: ExerciseResponse }
  | { kind: 'derive'; parent: ExerciseResponse }

/** The library — every movement with its theory, colored by category. */
export function ExercisesPage() {
  const { t } = useTranslation('gym')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)
  const [muscle, setMuscle] = useState<Muscle | ''>('')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [form, setForm] = useState<FormState>({ kind: 'closed' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['exercises'], queryFn: fetchExercises })

  const exercises = (query.data ?? [])
    .filter((e) => !e.archived)
    .filter((e) => category == null || e.category === category)
    .filter((e) => muscle === '' || e.muscles.includes(muscle))
    .filter((e) => equipment === '' || e.equipment === equipment)
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <RenfoTabs active="exercices" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('exercises.searchPlaceholder')}
          aria-label={t('exercises.searchAria')}
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
              {categoryLabel(c)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setForm({ kind: 'create' })}
          className="ml-auto rounded-lg bg-pine-600 px-3.5 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {t('exercises.new')}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={muscle}
          onChange={(event) => setMuscle(event.target.value as Muscle | '')}
          aria-label={t('exercises.filterMuscleAria')}
          className="rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none dark:border-moss-750 dark:bg-moss-800"
        >
          <option value="">{t('exercises.allMuscles')}</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {muscleLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={equipment}
          onChange={(event) => setEquipment(event.target.value as Equipment | '')}
          aria-label={t('exercises.filterEquipmentAria')}
          className="rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none dark:border-moss-750 dark:bg-moss-800"
        >
          <option value="">{t('exercises.allEquipment')}</option>
          {EQUIPMENTS.map((e) => (
            <option key={e} value={e}>
              {equipmentLabel(e)}
            </option>
          ))}
        </select>
        {(muscle || equipment) && (
          <button
            onClick={() => {
              setMuscle('')
              setEquipment('')
            }}
            className="text-xs font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('exercises.clearFilters')}
          </button>
        )}
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

      {query.isLoading && <p className={`mt-8 text-center ${muted}`}>{t('common:loading')}</p>}
      {query.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          {t('exercises.loadError')}
        </p>
      )}
      {query.data && exercises.length === 0 && (
        <p className={`mt-8 text-center ${muted}`}>
          {query.data.filter((e) => !e.archived).length === 0
            ? t('exercises.emptyLibrary')
            : t('exercises.noMatch')}
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
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null)

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
    onSuccess: () => {
      setConfirming(null)
      void queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteExercise(exercise.id),
    onSuccess: () => {
      setConfirming(null)
      void queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
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
            {categoryLabel(exercise.category)}
          </span>
          {exercise.derivedFromName && (
            <span className={`text-xs ${muted}`}>← {exercise.derivedFromName}</span>
          )}
        </div>
        <p className={`mt-0.5 text-xs ${muted}`}>
          {equipmentLabel(exercise.equipment)} · {measureLabel(exercise.measure)}
          {exercise.muscles.length > 0 &&
            ` · ${exercise.muscles.map((m) => muscleLabel(m)).join(', ')}`}
        </p>
      </button>

      {expanded && (
        <div className="border-t border-moss-200 p-3 text-sm dark:border-moss-750">
          {exercise.description && <p className="whitespace-pre-line">{exercise.description}</p>}
          {exercise.runningBenefit && (
            <p className={`mt-2 ${muted}`}>
              <span className="font-medium text-ink dark:text-linen">{t('exercises.whyForTrail')}</span>
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
              {t('exercises.viewResource')}
            </a>
          )}
          {!exercise.description && !exercise.runningBenefit && !exercise.resourceUrl && (
            <p className={muted}>{t('exercises.noSheet')}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton onClick={onEdit}>{t('common:edit')}</ActionButton>
            <ActionButton onClick={onDerive}>{t('exercises.derive')}</ActionButton>
            <ActionButton onClick={() => setConfirming('archive')} disabled={archiveMutation.isPending}>
              {t('exercises.archive')}
            </ActionButton>
            <ActionButton
              onClick={() => setConfirming('delete')}
              disabled={deleteMutation.isPending}
              danger
            >
              {t('common:delete')}
            </ActionButton>
            {confirming === 'archive' && (
              <ConfirmDialog
                title={t('exercises.archive')}
                message={t('exercises.archiveConfirm', { name: exercise.name })}
                confirmLabel={t('exercises.archive')}
                busy={archiveMutation.isPending}
                onConfirm={() => archiveMutation.mutate()}
                onCancel={() => setConfirming(null)}
              />
            )}
            {confirming === 'delete' && (
              <ConfirmDialog
                title={t('common:delete')}
                message={t('exercises.deleteConfirm', { name: exercise.name })}
                confirmLabel={t('common:delete')}
                danger
                busy={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setConfirming(null)}
              />
            )}
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
