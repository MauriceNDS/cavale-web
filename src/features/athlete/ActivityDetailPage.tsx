import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { StreamCharts } from '../../components/StreamCharts'
import { dateLocale, numberLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import { effortLabel } from '../calendar/labels'
import { ActivityShoeRow } from '../shoes/ActivityShoeRow'
import { fetchSession, type PerceivedEffort } from '../calendar/api'
import { ActivityMap } from './ActivityMap'
import { ZoneBars } from './ZoneBars'
import { fetchActivityDetail, fetchActivityStreams, fetchHub } from './api'

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
  // The linked session brings the planned workout structure (per-segment chart).
  const session = useQuery({
    queryKey: ['session', query.data?.sessionId],
    queryFn: () => fetchSession(query.data!.sessionId!),
    enabled: query.data?.sessionId != null,
  })
  // Profile HR bounds for the zone bars (hub is cached from the home page).
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })
  // The charts' shared cursor, in km — also drives the map marker.
  const [hoverKm, setHoverKm] = useState<number | null>(null)

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

  // km-effort (km + D+/100) IS the distance of a mountain run — promoted to
  // the primary row when the outing is genuinely hilly (≥ 25 m D+/km).
  const kmEffort =
    a.distanceKm != null && a.distanceKm > 0 && a.elevationM != null
      ? Math.round((Number(a.distanceKm) + a.elevationM / 100) * 10) / 10
      : null
  const hilly = kmEffort != null && a.elevationM! / Number(a.distanceKm) >= 25

  // Two-tier stat hierarchy: the numbers a runner checks first, big;
  // the rest compact underneath.
  const primaryTiles = [
    a.distanceKm != null && { label: t('activityDetail.distance'), value: `${a.distanceKm} km` },
    hilly && { label: t('activityDetail.kmEffort'), value: `${kmEffort} km-e` },
    { label: t('activityDetail.time'), value: formatDuration(a.durationMin) },
    pace != null && { label: t('activityDetail.avgPace'), value: formatPace(pace) },
  ].filter(Boolean) as { label: string; value: string }[]

  const secondaryTiles = [
    a.elevationM != null && {
      label: t('activityDetail.elevation'),
      value: `${a.elevationM.toLocaleString(numberLocale())} m`,
    },
    !hilly &&
      kmEffort != null &&
      a.elevationM! > 0 && { label: t('activityDetail.kmEffort'), value: `${kmEffort} km-e` },
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
    a.decouplingPct != null && {
      label: t('activityDetail.decoupling'),
      value: `${a.decouplingPct.toFixed(1)} %`,
      tone:
        a.decouplingPct <= 5
          ? 'text-pine-700 dark:text-pine-300'
          : a.decouplingPct <= 8
            ? 'text-gold-600 dark:text-gold-300'
            : 'text-clay-500 dark:text-clay-300',
    },
  ].filter(Boolean) as { label: string; value: string; tone?: string }[]

  const profile = hub.data?.profile
  const totalKm = a.distanceKm != null ? Number(a.distanceKm) : null

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 pb-10">
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

        <div className={`mt-4 grid gap-3 ${primaryTiles.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          {primaryTiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>{tile.label}</p>
              <p className="mt-0.5 font-display text-xl font-semibold whitespace-nowrap sm:text-2xl">
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        {secondaryTiles.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {secondaryTiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-moss-200 bg-moss-50 px-3 py-2 dark:border-moss-750 dark:bg-moss-900">
                <p className={`text-[11px] ${muted}`}>{tile.label}</p>
                <p className={`mt-0.5 text-base font-semibold ${tile.tone ?? ''}`}>{tile.value}</p>
              </div>
            ))}
          </div>
        )}

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

        {a.mapPolyline && (
          <ActivityMap
            polyline={a.mapPolyline}
            hoverFraction={hoverKm != null && totalKm ? hoverKm / totalKm : null}
          />
        )}

        {a.hasStreams && streams.data && (
          <StreamCharts
            streams={streams.data}
            workout={session.data?.workout}
            onHoverX={setHoverKm}
          />
        )}
        {a.hasStreams && streams.data && profile?.maxHr != null && (
          <ZoneBars streams={streams.data} maxHr={profile.maxHr} restingHr={profile.restingHr} />
        )}
        {a.hasStreams && streams.isLoading && (
          <p className={`mt-4 text-sm ${muted}`}>{t('activityDetail.loadingCharts')}</p>
        )}
      </section>
    </div>
  )
}
