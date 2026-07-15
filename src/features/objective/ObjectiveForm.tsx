import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ErrorAlert } from '../../components/form'
import type { ObjectiveResponse, ObjectiveType, UpdateObjectivePayload } from './api'
import { OBJECTIVE_TYPES, objectiveTypeLabel } from './labels'

// Built per render so validation messages follow the active language.
const buildSchema = (t: (key: string) => string) =>
  z.object({
    type: z.enum(['RACE', 'RECOVERY', 'FITNESS', 'GENERAL']),
    name: z.string().trim().min(1, t('form.errors.nameRequired')).max(150, t('form.errors.max150')),
    date: z.string().nullable(),
    location: z.string().trim().max(150, t('form.errors.max150')).nullable(),
    distanceKm: z.number().positive(t('form.errors.invalidDistance')).nullable(),
    elevationGainM: z.number().int().positive(t('form.errors.invalidElevation')).nullable(),
    targetTimeMin: z.number().int().positive(t('form.errors.invalidTime')).nullable(),
    resultTimeMin: z.number().int().positive(t('form.errors.invalidTime')).nullable(),
    notes: z.string().trim().nullable(),
  })

function toMinutes(hours: string, minutes: string): number | null {
  if (hours === '' && minutes === '') return null
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0)
}

function hoursOf(min: number | null): string {
  return min == null ? '' : String(Math.floor(min / 60))
}

function minutesOf(min: number | null): string {
  return min == null ? '' : String(min % 60)
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

interface ObjectiveFormProps {
  /** Absent when creating a secondary objective. */
  objective?: ObjectiveResponse
  /** Result fields only make sense on an existing objective. */
  pending: boolean
  error: string | null
  onSubmit: (payload: UpdateObjectivePayload) => void
  onCancel: () => void
}

export function ObjectiveForm({ objective, pending, error, onSubmit, onCancel }: ObjectiveFormProps) {
  const { t } = useTranslation('objective')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (name: string) => {
      const value = (data.get(name) as string | null)?.trim()
      return value ? value : null
    }
    const num = (name: string) => {
      const value = (data.get(name) as string | null)?.trim().replace(',', '.')
      return value ? Number(value) : null
    }

    const candidate = {
      type: data.get('type') as ObjectiveType,
      name: (data.get('name') as string) ?? '',
      date: text('date'),
      location: text('location'),
      distanceKm: num('distanceKm'),
      elevationGainM: num('elevationGainM'),
      targetTimeMin: toMinutes(
        (data.get('targetH') as string) ?? '',
        (data.get('targetM') as string) ?? '',
      ),
      resultTimeMin: objective
        ? toMinutes((data.get('resultH') as string) ?? '', (data.get('resultM') as string) ?? '')
        : null,
      notes: text('notes'),
    }

    const parsed = buildSchema(t).safeParse(candidate)
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message)
      return
    }
    setValidationError(null)
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">{t('form.name')}</span>
          <input name="name" defaultValue={objective?.name} required maxLength={150} className={fieldClass} />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t('form.type')}</span>
          <select name="type" defaultValue={objective?.type ?? 'RACE'} className={fieldClass}>
            {OBJECTIVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {objectiveTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t('form.date')}</span>
          <input name="date" type="date" defaultValue={objective?.date ?? ''} className={fieldClass} />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{t('form.location')}</span>
          <input
            name="location"
            defaultValue={objective?.location ?? ''}
            maxLength={150}
            placeholder={t('form.locationPlaceholder')}
            className={fieldClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">{t('form.distance')}</span>
            <input
              name="distanceKm"
              type="number"
              step="0.1"
              min="0"
              defaultValue={objective?.distanceKm ?? ''}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('form.elevationGain')}</span>
            <input
              name="elevationGainM"
              type="number"
              min="0"
              defaultValue={objective?.elevationGainM ?? ''}
              className={fieldClass}
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{t('form.targetTime')}</legend>
          <div className="mt-1 flex items-center gap-2">
            <input
              name="targetH"
              type="number"
              min="0"
              defaultValue={hoursOf(objective?.targetTimeMin ?? null)}
              aria-label={t('form.hours')}
              className={`${fieldClass} mt-0 w-20`}
            />
            <span className="text-sm text-moss-500 dark:text-moss-400">h</span>
            <input
              name="targetM"
              type="number"
              min="0"
              max="59"
              defaultValue={minutesOf(objective?.targetTimeMin ?? null)}
              aria-label={t('form.minutes')}
              className={`${fieldClass} mt-0 w-20`}
            />
            <span className="text-sm text-moss-500 dark:text-moss-400">min</span>
          </div>
        </fieldset>

        {objective && (
          <fieldset>
            <legend className="text-sm font-medium">{t('form.resultTime')}</legend>
            <div className="mt-1 flex items-center gap-2">
              <input
                name="resultH"
                type="number"
                min="0"
                defaultValue={hoursOf(objective.resultTimeMin)}
                aria-label={t('form.hours')}
                className={`${fieldClass} mt-0 w-20`}
              />
              <span className="text-sm text-moss-500 dark:text-moss-400">h</span>
              <input
                name="resultM"
                type="number"
                min="0"
                max="59"
                defaultValue={minutesOf(objective.resultTimeMin)}
                aria-label={t('form.minutes')}
                className={`${fieldClass} mt-0 w-20`}
              />
              <span className="text-sm text-moss-500 dark:text-moss-400">min</span>
            </div>
          </fieldset>
        )}

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">{t('form.notes')}</span>
          <textarea
            name="notes"
            defaultValue={objective?.notes ?? ''}
            rows={2}
            placeholder={t('form.notesPlaceholder')}
            className={fieldClass}
          />
        </label>
      </div>

      {(validationError || error) && <ErrorAlert message={validationError ?? error ?? ''} />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {pending ? t('common:saving') : t('common:save')}
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
