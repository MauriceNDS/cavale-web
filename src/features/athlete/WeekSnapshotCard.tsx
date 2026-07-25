import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { numberLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import { fetchPlanDetail, type WeekResponse } from '../calendar/api'
import type { AthleteHub } from './api'
import { formatHours } from './labels'

/**
 * The "am I on track this week?" card: km / D+ / time done so far, next to
 * last week's numbers and — when a season is active — the plan's target.
 */
export function WeekSnapshotCard({ hub }: { hub: AthleteHub }) {
  const { t } = useTranslation('athlete')
  const thisWeek = hub.weekly.at(-1)
  const lastWeek = hub.weekly.at(-2)
  const currentSeason = hub.seasons.find((s) => s.timeframe === 'CURRENT')

  const plan = useQuery({
    queryKey: ['plan-detail', currentSeason?.planId],
    queryFn: () => fetchPlanDetail(currentSeason!.planId),
    enabled: !!currentSeason,
  })

  if (!thisWeek) return null

  const planWeek: WeekResponse | undefined = plan.data?.weeks.find(
    (w) => w.startDate === thisWeek.weekStart,
  )
  const targetKm = planWeek?.estimatedVolumeKm ?? planWeek?.targetVolumeKm ?? null
  const targetD = planWeek?.targetElevationM ?? null

  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('home.week.title')}</h2>
        {planWeek?.weekType && (
          <span className={`text-xs ${muted}`}>{t(`calendar:weekType.${planWeek.weekType}`)}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Metric
          value={`${Math.round(Number(thisWeek.distanceKm))} km`}
          target={targetKm != null ? t('home.week.target', { value: `${Math.round(targetKm)} km` }) : null}
          progress={targetKm ? Number(thisWeek.distanceKm) / targetKm : null}
          last={lastWeek ? `${Math.round(Number(lastWeek.distanceKm))} km` : null}
          lastLabel={t('home.week.lastWeek')}
        />
        <Metric
          value={`${thisWeek.elevationM.toLocaleString(numberLocale())} m D+`}
          target={
            targetD != null
              ? t('home.week.target', { value: `${targetD.toLocaleString(numberLocale())} m` })
              : null
          }
          progress={targetD ? thisWeek.elevationM / targetD : null}
          last={lastWeek ? `${lastWeek.elevationM.toLocaleString(numberLocale())} m` : null}
          lastLabel={t('home.week.lastWeek')}
        />
        <Metric
          value={formatHours(thisWeek.durationMin)}
          target={null}
          progress={null}
          last={lastWeek ? formatHours(lastWeek.durationMin) : null}
          lastLabel={t('home.week.lastWeek')}
        />
      </div>
      {!currentSeason && <p className={`mt-2 text-xs ${muted}`}>{t('home.week.noPlan')}</p>}
    </section>
  )
}

function Metric({
  value,
  target,
  progress,
  last,
  lastLabel,
}: {
  value: string
  target: string | null
  progress: number | null
  last: string | null
  lastLabel: string
}) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      {progress != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-moss-100 dark:bg-moss-800">
          <div
            className={`h-full rounded-full ${progress > 1.15 ? 'bg-clay-500 dark:bg-clay-300' : 'bg-pine-600 dark:bg-pine-350'}`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      )}
      <p className={`mt-1 text-xs ${muted}`}>
        {target != null && (
          <>
            {target}
            <br />
          </>
        )}
        {last != null && `${lastLabel} ${last}`}
      </p>
    </div>
  )
}
