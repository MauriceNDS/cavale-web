import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { muted } from '../../lib/ui'
import type { ExerciseResponse } from './api'
import { CATEGORY_BADGE, categoryLabel, equipmentLabel, muscleLabel } from './labels'

/**
 * The exercise's theory sheet, one tap away mid-workout: how to perform it,
 * what it targets and why a trail runner does it.
 */
export function ExerciseDetailSheet({
  exercise,
  onClose,
}: {
  exercise: ExerciseResponse
  onClose: () => void
}) {
  const { t } = useTranslation('gym')

  return (
    <Modal title={exercise.name} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[exercise.category]}`}>
            {categoryLabel(exercise.category)}
          </span>
          <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[11px] font-medium text-moss-500 dark:bg-moss-800 dark:text-moss-400">
            {equipmentLabel(exercise.equipment)}
          </span>
          {exercise.muscles.map((muscle) => (
            <span
              key={muscle}
              className="rounded-full bg-moss-100 px-2 py-0.5 text-[11px] dark:bg-moss-800"
            >
              {muscleLabel(muscle)}
            </span>
          ))}
        </div>

        {exercise.description ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {t('detailSheet.howTo')}
            </p>
            <p className="mt-1 whitespace-pre-line">{exercise.description}</p>
          </div>
        ) : (
          <p className={muted}>{t('exercises.noSheet')}</p>
        )}

        {exercise.runningBenefit && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {t('detailSheet.whyForTrail')}
            </p>
            <p className="mt-1">{exercise.runningBenefit}</p>
          </div>
        )}

        {exercise.resourceUrl && (
          <a
            href={exercise.resourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('exercises.viewResource')}
          </a>
        )}
      </div>
    </Modal>
  )
}
