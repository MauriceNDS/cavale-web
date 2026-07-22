import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { assignShoeToActivity, fetchShoes } from './api'

/**
 * "Which pair ran this?" — one select on a validated or history activity.
 * Active pairs are offered; a retired pair already assigned stays visible.
 * Saves on change, so mileage is honest one tap after the oversight.
 */
export function ActivityShoeRow({
  activityId,
  shoeId,
  onSaved,
}: {
  activityId: string
  shoeId: string | null
  onSaved: () => void
}) {
  const { t } = useTranslation('calendar')
  const queryClient = useQueryClient()
  const shoes = useQuery({ queryKey: ['shoes'], queryFn: fetchShoes, staleTime: 60_000, retry: false })

  const mutation = useMutation({
    mutationFn: (next: string | null) => assignShoeToActivity(activityId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shoes'] })
      onSaved()
    },
  })

  const all = shoes.data ?? []
  const options = all.filter((s) => !s.retired || s.id === shoeId)
  if (options.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('report.shoe')}
      </p>
      <select
        value={shoeId ?? ''}
        onChange={(event) => mutation.mutate(event.target.value || null)}
        disabled={mutation.isPending}
        aria-label={t('report.shoe')}
        className="min-w-0 flex-1 rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 disabled:opacity-50 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
      >
        <option value="">{t('wizard.shoeNone')}</option>
        {options.map((shoe) => (
          <option key={shoe.id} value={shoe.id}>
            {shoe.name}
            {shoe.brand ? ` · ${shoe.brand}` : ''}
            {shoe.retired ? ` (${t('report.shoeRetired')})` : ''}
          </option>
        ))}
      </select>
      {mutation.error instanceof ApiError && (
        <p role="alert" className="w-full text-xs text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
    </div>
  )
}
