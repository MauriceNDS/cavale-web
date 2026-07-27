import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { dateLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { card, muted } from '../../lib/ui'
import { fetchHub, type Season } from '../athlete/api'
import { deletePlan } from '../calendar/api'
import { OBJECTIVE_TYPE_BADGE, formatTimeMin, objectiveTypeLabel } from './labels'
import { SeasonForm } from './SeasonForm'

/**
 * Season management: finished seasons on one side, planned ones (plus the
 * "plan the next one" form) on the other. The CURRENT season is deliberately
 * absent — it is the rest of the page.
 */
export function SeasonsSection() {
  const { t } = useTranslation('objective')
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })
  const seasons = hub.data?.seasons ?? []
  const past = seasons.filter((s) => s.timeframe === 'PAST')
  const future = seasons.filter((s) => s.timeframe === 'FUTURE')

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">{t('seasons.title')}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SeasonColumn title={t('seasons.upcoming')}>
          {future.map((season) => (
            <SeasonCard key={season.planId} season={season} deletable />
          ))}
          <NextSeasonForm hasFuture={future.length > 0} />
        </SeasonColumn>
        <SeasonColumn title={t('seasons.past')}>
          {past.length === 0 && <p className={`text-sm ${muted}`}>{t('seasons.noPast')}</p>}
          {past
            .slice()
            .reverse()
            .map((season) => (
              <SeasonCard key={season.planId} season={season} />
            ))}
        </SeasonColumn>
      </div>
    </section>
  )
}

function SeasonColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  )
}

function SeasonCard({ season, deletable }: { season: Season; deletable?: boolean }) {
  const { t } = useTranslation('objective')
  const queryClient = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const objective = season.objective
  const date = objective?.date ?? season.endDate

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub'] })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
  })

  return (
    <div className="rounded-lg border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{objective?.name ?? season.planName}</p>
        {objective && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_TYPE_BADGE[objective.type]}`}>
            {objectiveTypeLabel(objective.type)}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-sm ${muted}`}>
        {format(parseISO(date), 'd MMM yyyy', { locale: dateLocale() })}
        {objective?.distanceKm != null && ` · ${objective.distanceKm} km`}
        {objective?.resultTimeMin != null &&
          ` · ${t('seasons.doneChip', { time: formatTimeMin(objective.resultTimeMin) })}`}
        {objective?.resultTimeMin == null &&
          objective?.targetTimeMin != null &&
          ` · ${t('seasons.targetChip', { time: formatTimeMin(objective.targetTimeMin) })}`}
      </p>
      {deletable && (
        <>
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={deleteMutation.isPending}
            className="mt-1 text-xs font-medium text-clay-500 transition hover:text-clay-600 disabled:opacity-50 dark:text-clay-300 dark:hover:text-clay-300/80"
          >
            {t('common:delete')}
          </button>
          {confirmingDelete && (
            <ConfirmDialog
              title={t('common:delete')}
              message={t('seasons.deleteConfirm', { name: objective?.name ?? season.planName })}
              confirmLabel={t('common:delete')}
              danger
              busy={deleteMutation.isPending}
              onConfirm={() => deleteMutation.mutate(season.planId)}
              onCancel={() => setConfirmingDelete(false)}
            />
          )}
        </>
      )}
      {deleteMutation.error instanceof ApiError && (
        <p role="alert" className="mt-1 text-xs text-clay-500 dark:text-clay-300">
          {deleteMutation.error.message}
        </p>
      )}
      {season.timeframe === 'FUTURE' && differenceInCalendarDays(parseISO(date), new Date()) >= 0 && (
        <p className={`mt-1 text-xs ${muted}`}>
          {t('seasons.countdown', {
            count: differenceInCalendarDays(parseISO(date), new Date()),
          })}
        </p>
      )}
    </div>
  )
}

/** Plan the next season — full details, same form as the main objective. */
function NextSeasonForm({ hasFuture }: { hasFuture: boolean }) {
  const { t } = useTranslation('objective')
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full rounded-lg border border-dashed border-moss-300 px-3 py-2 text-sm font-medium ${muted} transition hover:border-pine-600 hover:text-pine-700 dark:border-moss-700 dark:hover:border-pine-350 dark:hover:text-pine-300`}
      >
        {hasFuture ? t('seasons.addAnother') : t('seasons.addFirst')}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <SeasonForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
    </div>
  )
}
