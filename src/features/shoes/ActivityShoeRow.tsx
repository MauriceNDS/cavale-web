import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { assignShoeToActivity, fetchShoes } from './api'
import { ShoePicker } from './ShoePicker'

/**
 * "Which pair ran this?" — one picker on a validated or history activity.
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
      <div className="min-w-0 flex-1">
        <ShoePicker
          shoes={options}
          value={shoeId}
          onChange={(next) => mutation.mutate(next)}
          disabled={mutation.isPending}
          label={t('report.shoe')}
        />
      </div>
      {mutation.error instanceof ApiError && (
        <p role="alert" className="w-full text-xs text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
    </div>
  )
}
