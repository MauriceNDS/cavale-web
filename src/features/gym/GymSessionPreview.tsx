import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { muted } from '../../lib/ui'
import { fetchVariant, type Muscle, type TemplateExerciseResponse } from './api'
import {
  CATEGORY_BADGE,
  CATEGORY_EDGE,
  categoryLabel,
  formatPrescription,
  formatRest,
  muscleLabel,
} from './labels'

/**
 * What a gym session actually asks of you, shown before you commit to it —
 * the counterpart of the RUN workout tree. Read-only on purpose: this is the
 * page where the athlete decides whether they have the hour and the legs for
 * it, and the runner is where the work gets logged.
 */
export function GymSessionPreview({ variantId }: { variantId: string }) {
  const { t } = useTranslation('gym')
  const { data: variant, isPending, isError } = useQuery({
    queryKey: ['gym', 'variant', variantId],
    queryFn: () => fetchVariant(variantId),
  })

  if (isPending) {
    return <p className={`mt-5 text-sm ${muted}`}>{t('preview.loading')}</p>
  }
  if (isError || variant.exercises.length === 0) {
    return <p className={`mt-5 text-sm ${muted}`}>{t('preview.empty')}</p>
  }

  const exercises = variant.exercises
  const groupKeys = exercises.map((e) => e.groupKey)
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0)
  // Which body parts the session actually loads — the one-line "is this legs
  // or core today?" answer, most-worked first.
  const muscles = topMuscles(exercises)

  return (
    <section className="mt-5">
      <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('preview.title')}
      </h2>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Chip value={t('preview.exerciseCount', { count: exercises.length })} />
        <Chip value={t('preview.setCount', { count: totalSets })} />
        {muscles.length > 0 && <Chip value={muscles.map(muscleLabel).join(' · ')} />}
      </div>

      {variant.note && <p className={`mt-2 text-sm ${muted}`}>{variant.note}</p>}

      <ol className="mt-3 space-y-2">
        {exercises.map((te, index) => {
          const groupedWithPrevious = te.groupKey != null && groupKeys[index - 1] === te.groupKey
          const groupedWithNext = te.groupKey != null && groupKeys[index + 1] === te.groupKey
          return (
            <li
              key={te.id}
              className={`rounded-lg border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${
                CATEGORY_EDGE[te.exercise.category]
              } ${
                // A superset reads as one block: members sit tight together,
                // ringed in teal, only the outer corners rounded.
                te.groupKey == null
                  ? ''
                  : `ring-1 ring-teal-600/40 dark:ring-teal-300/30 ${
                      groupedWithPrevious ? 'mt-0 rounded-t-none' : ''
                    } ${groupedWithNext ? 'mb-0 rounded-b-none' : ''}`
              }`}
              style={groupedWithPrevious ? { marginTop: '-0.5rem' } : undefined}
            >
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                {te.groupKey != null && (
                  <span className="shrink-0 rounded bg-teal-600/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-600 tabular-nums dark:bg-teal-300/15 dark:text-teal-300">
                    {te.groupKey}
                    {groupKeys.slice(0, index).filter((k) => k === te.groupKey).length + 1}
                  </span>
                )}
                <span className="font-medium">{te.exercise.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    CATEGORY_BADGE[te.exercise.category]
                  }`}
                >
                  {categoryLabel(te.exercise.category)}
                </span>
              </div>
              <p className={`mt-0.5 text-xs ${muted}`}>
                <span className="font-semibold text-ink dark:text-linen">
                  {formatPrescription(te.sets, te.reps, te.seconds)}
                </span>
                {te.intensityPct != null && ` · ${te.intensityPct} %`}
                {formatRest(te.restSec) != null &&
                  ` · ${t(
                    groupedWithNext ? 'editor.groups.restBeforeNext' : 'editor.groups.restAfter',
                    { rest: formatRest(te.restSec) },
                  )}`}
                {te.note && ` · ${te.note}`}
              </p>
              {te.alternatives.length > 0 && (
                <p className={`mt-0.5 text-[11px] ${muted}`}>
                  {t('preview.alternatives', {
                    names: te.alternatives.map((a) => a.exercise.name).join(', '),
                  })}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Chip({ value }: { value: string }) {
  return (
    <span className="rounded-lg border border-moss-200 bg-moss-25 px-2.5 py-1 font-medium dark:border-moss-750 dark:bg-moss-850">
      {value}
    </span>
  )
}

/** The three muscles carrying the most sets — enough to place the session. */
function topMuscles(exercises: TemplateExerciseResponse[]): Muscle[] {
  const setsPerMuscle = new Map<Muscle, number>()
  for (const te of exercises) {
    for (const muscle of te.exercise.muscles) {
      setsPerMuscle.set(muscle, (setsPerMuscle.get(muscle) ?? 0) + te.sets)
    }
  }
  return [...setsPerMuscle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([muscle]) => muscle)
}
