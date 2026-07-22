import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { StreamCharts } from '../../components/StreamCharts'
import { dateLocale, numberLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import { effortLabel } from '../calendar/labels'
import { ActivityShoeRow } from '../shoes/ActivityShoeRow'
import type { PerceivedEffort } from '../calendar/api'
import { fetchActivityDetail, fetchActivityStreams } from './api'

function formatDuration(min: number): string {
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`
}

export function ActivityDetailPage() {
  const { t } = useTranslation('athlete')
  const params = useParams({ strict: false }) as { activityId?: string }
  const activityId = params.activityId!

  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => fetchActivityDetail(activityId),
  })
  const streams = useQuery({
    queryKey: ['activity-streams', activityId],
    queryFn: () => fetchActivityStreams(activityId),
    enabled: query.data?.hasStreams ?? false,
  })

  if (query.isLoading) {
    return <p className={`mt-16 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!query.data) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className={muted}>{t('activityDetail.notFound')}</p>
        <Link to="/activites" className="mt-3 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300">
          {t('activityDetail.back')}
        </Link>
      </div>
    )
  }

  const a = query.data
  const pace =
    a.distanceKm != null && a.distanceKm > 0
      ? Math.round((a.durationMin * 60) / a.distanceKm)
      : null

  const tiles = [
    a.distanceKm != null && { label: t('activityDetail.distance'), value: `${a.distanceKm} km` },
    { label: t('activityDetail.time'), value: formatDuration(a.durationMin) },
    pace != null && { label: t('activityDetail.avgPace'), value: formatPace(pace) },
    a.elevationM != null && {
      label: t('activityDetail.elevation'),
      value: `${a.elevationM.toLocaleString(numberLocale())} m`,
    },
    a.avgHr != null && { label: t('activityDetail.avgHr'), value: `${a.avgHr} bpm` },
    a.maxHr != null && { label: t('activityDetail.maxHr'), value: `${a.maxHr} bpm` },
    a.avgCadenceSpm != null && {
      label: t('activityDetail.cadence'),
      value: `${Math.round(Number(a.avgCadenceSpm))} spm`,
    },
    a.relativeEffort != null && {
      label: t('activityDetail.relativeEffort'),
      value: String(a.relativeEffort),
    },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="mx-auto mt-6 max-w-2xl space-y-4 pb-10">
      <Link to="/activites" className="inline-flex items-center gap-1 text-sm font-medium text-pine-700 hover:underline dark:text-pine-300">
        ← {t('activityDetail.back')}
      </Link>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-balance">
              {a.name ?? t('activityDetail.runFallback')}
            </h1>
            <p className={`mt-1 text-sm ${muted}`}>
              {format(parseISO(a.date), 'EEEE d MMMM yyyy', { locale: dateLocale() })}
            </p>
          </div>
          {a.source && (
            <span className="rounded-full bg-moss-100 px-2.5 py-1 text-xs font-medium dark:bg-moss-800">
              {a.source === 'STRAVA' ? t('activityDetail.fromStrava') : t('activityDetail.manual')}
            </span>
          )}
        </div>

        {a.sessionId && (
          <Link
            to="/session/$sessionId"
            params={{ sessionId: a.sessionId }}
            className="mt-2 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('activityDetail.linkedSession')}
          </Link>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>{tile.label}</p>
              <p className="mt-0.5 text-xl font-semibold">{tile.value}</p>
            </div>
          ))}
        </div>

        {a.discipline === 'RUN' && (
          <ActivityShoeRow
            activityId={a.id}
            shoeId={a.shoeId}
            onSaved={() =>
              void queryClient.invalidateQueries({ queryKey: ['activity', a.id] })
            }
          />
        )}

        {(a.perceivedEffort || a.painFlag || a.comment) && (
          <div className="mt-3 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
            <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {t('activityDetail.feeling')}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {a.perceivedEffort ? effortLabel(a.perceivedEffort as PerceivedEffort) : '—'}
              {a.painFlag && (
                <span className="ml-2 rounded-full bg-clay-100 px-2 py-0.5 text-xs font-semibold text-clay-600 dark:bg-clay-900 dark:text-clay-300">
                  {t('activityDetail.painReported')}
                </span>
              )}
            </p>
            {a.comment && (
              <p className={`mt-1 text-sm whitespace-pre-line ${muted}`}>{a.comment}</p>
            )}
          </div>
        )}

        {a.hasStreams && streams.data && <StreamCharts streams={streams.data} />}
        {a.hasStreams && streams.isLoading && (
          <p className={`mt-4 text-sm ${muted}`}>{t('activityDetail.loadingCharts')}</p>
        )}
      </section>
    </div>
  )
}
