import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ErrorAlert } from '../../components/form'
import { ApiError } from '../../lib/api'
import { createPlan } from '../calendar/api'
import { ObjectiveFields, buildObjectiveSchema, fieldClass, readObjectiveFields } from './ObjectiveForm'

/**
 * Creates a season (training plan) together with its fully-specified MAIN
 * objective — the one flow behind "plan the next objective" on the home page
 * and the first-objective empty state on the objective page.
 */
export function SeasonForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation('objective')
  const queryClient = useQueryClient()
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub'] })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onDone()
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const objective = readObjectiveFields(data, false)
    const parsed = buildObjectiveSchema(t).safeParse(objective)
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message)
      return
    }
    setValidationError(null)
    // resultTimeMin only exists on the edit form; a season is created before its race.
    const { resultTimeMin: _unused, ...objectivePayload } = parsed.data
    mutation.mutate({
      name: (data.get('seasonName') as string).trim(),
      startDate: data.get('startDate') as string,
      endDate: data.get('endDate') as string,
      objective: objectivePayload,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-left">
      <p className="text-[11px] font-semibold tracking-wide uppercase text-moss-500 dark:text-moss-400">
        {t('season.sectionSeason')}
      </p>
      <label className="block">
        <span className="text-sm font-medium">{t('season.name')}</span>
        <input
          name="seasonName"
          required
          maxLength={150}
          placeholder={t('season.namePlaceholder')}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">{t('season.start')}</span>
          <input name="startDate" type="date" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('season.end')}</span>
          <input name="endDate" type="date" required className={fieldClass} />
        </label>
      </div>

      <p className="pt-1 text-[11px] font-semibold tracking-wide uppercase text-moss-500 dark:text-moss-400">
        {t('season.sectionObjective')}
      </p>
      <ObjectiveFields />

      {(validationError || mutation.error instanceof ApiError) && (
        <ErrorAlert message={validationError ?? (mutation.error as ApiError).message} />
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {mutation.isPending ? t('common:creating') : t('common:create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-moss-500 transition hover:text-ink dark:text-moss-400 dark:hover:text-linen"
        >
          {t('common:cancel')}
        </button>
      </div>
    </form>
  )
}
