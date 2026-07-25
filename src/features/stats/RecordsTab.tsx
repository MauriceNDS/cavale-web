import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import type { RoadPrediction, RunningStatsResponse, TrailEstimate, TrailIndex } from '../athlete/api'
import { fetchHub } from '../athlete/api'
import { formatChrono as formatRace, formatHours, formatPace as formatRacePace } from '../athlete/labels'
import { formatChrono } from './format'

/**
 * Records & predictions: what the athlete has done (records, longest runs,
 * trail index) next to what the models say they could do (Riegel estimates,
 * road model ranges, trail objective estimates).
 */
export function RecordsTab({ stats }: { stats: RunningStatsResponse }) {
  const { t } = useTranslation('stats')
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })

  if (hub.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  const data = hub.data
  if (!data) {
    return <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('loadError')}</p>
  }
  const { records, longestRuns, predictions, sync, trailIndex } = data

  return (
    <>
      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{t('records.title')}</h2>
        {trailIndex && <TrailIndexTile trailIndex={trailIndex} />}
        {records.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>
            {sync.stravaConnected
              ? sync.recordsPending > 0
                ? t('records.emptyAnalyze')
                : t('records.emptySync')
              : t('records.emptyConnect')}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {records.map((record) => (
              <div key={record.label} className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
                <p className={`text-xs ${muted}`}>{record.label}</p>
                <p className="mt-0.5 text-xl font-semibold">{formatRace(record.seconds)}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {formatRacePace(Math.round((record.seconds * 1000) / record.distanceM))} ·{' '}
                  {format(parseISO(record.date), 'MMM yyyy', { locale: dateLocale() })}
                </p>
              </div>
            ))}
          </div>
        )}

        {(longestRuns.byDistance || longestRuns.byDuration) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {longestRuns.byDistance && (
              <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
                <p className={`text-xs ${muted}`}>{t('records.longestByDistance')}</p>
                <p className="mt-0.5 text-xl font-semibold">{longestRuns.byDistance.distanceKm} km</p>
                <p className={`mt-0.5 truncate text-xs ${muted}`}>
                  {longestRuns.byDistance.name ?? t('records.runFallback')} ·{' '}
                  {format(parseISO(longestRuns.byDistance.date), 'd MMM yyyy', { locale: dateLocale() })}
                </p>
              </div>
            )}
            {longestRuns.byDuration && (
              <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
                <p className={`text-xs ${muted}`}>{t('records.longestByDuration')}</p>
                <p className="mt-0.5 text-xl font-semibold">
                  {formatHours(longestRuns.byDuration.durationMin)}
                  <span className="text-sm font-normal"> ({formatRace(longestRuns.byDuration.durationMin * 60)})</span>
                </p>
                <p className={`mt-0.5 truncate text-xs ${muted}`}>
                  {longestRuns.byDuration.name ?? t('records.runFallback')} ·{' '}
                  {format(parseISO(longestRuns.byDuration.date), 'd MMM yyyy', { locale: dateLocale() })}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {(stats.trailEstimates.length > 0 || stats.roadPredictions.length > 0) && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('predictions.title')}</h2>
          {stats.trailEstimates.length > 0 && <TrailEstimates estimates={stats.trailEstimates} />}
          {stats.roadPredictions.length > 0 && <RoadPredictions predictions={stats.roadPredictions} />}
        </section>
      )}

      {predictions.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('records.estimatesTitle')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('records.estimatesIntro')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {predictions.map((prediction) => (
              <div key={prediction.label} className="rounded-lg border border-dashed border-moss-300 p-3 dark:border-moss-700">
                <p className={`text-xs ${muted}`}>{prediction.label}</p>
                <p className="mt-0.5 text-xl font-semibold">{formatRace(prediction.seconds)}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {formatRacePace(prediction.paceSecPerKm)} · {t('records.basedOn', { record: prediction.basedOn })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** The personal trail performance index — one number the athlete watches climb. */
function TrailIndexTile({ trailIndex }: { trailIndex: TrailIndex }) {
  const { t } = useTranslation('stats')
  return (
    <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-copper-600/30 bg-copper-600/5 p-4 dark:border-copper-300/30 dark:bg-copper-300/10">
      <div>
        <p className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>{t('records.trailIndexTitle')}</p>
        <p className={`mt-1 text-xs ${muted}`}>
          {trailIndex.bestEffortName
            ? t('records.trailIndexBestNamed', { name: trailIndex.bestEffortName, km: trailIndex.bestKmEffort })
            : t('records.trailIndexBest', { km: trailIndex.bestKmEffort })}
          {' · '}
          {t('records.trailIndexBasis', { count: trailIndex.sampleEfforts })}
        </p>
      </div>
      <p className="font-display text-4xl font-semibold text-copper-600 dark:text-copper-300">{trailIndex.index}</p>
    </div>
  )
}

function TrailEstimates({ estimates }: { estimates: TrailEstimate[] }) {
  const { t } = useTranslation('stats')
  return (
    <div className="mt-3 space-y-2">
      {estimates.map((estimate) => (
        <div
          key={`${estimate.objectiveName}-${estimate.date}`}
          className="rounded-lg border border-copper-600/30 bg-copper-600/5 p-3 dark:border-copper-300/30 dark:bg-copper-300/10"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {estimate.objectiveName}
              <span className={`ml-2 text-xs ${muted}`}>
                {format(parseISO(estimate.date), 'd MMM yyyy', { locale: dateLocale() })} · {estimate.distanceKm} km
                {estimate.elevationM != null && ` · ${estimate.elevationM} m D+`} · {estimate.kmEffort} km-effort
              </span>
            </p>
            <p className="text-lg font-semibold text-copper-600 dark:text-copper-300">
              {formatChrono(estimate.midSec)}
              <span className={`ml-1.5 text-xs font-normal ${muted}`}>
                ({formatChrono(estimate.lowSec)} – {formatChrono(estimate.highSec)})
              </span>
            </p>
          </div>
          <p className={`mt-1 text-xs ${muted}`}>{t('predictions.trailBasis', { count: estimate.sampleRuns })}</p>
        </div>
      ))}
    </div>
  )
}

function RoadPredictions({ predictions }: { predictions: RoadPrediction[] }) {
  const { t } = useTranslation('stats')
  return (
    <div className="mt-4 overflow-x-auto">
      <p className={`mb-1 text-xs ${muted}`}>{t('predictions.roadHint')}</p>
      <table className="w-full min-w-105 text-sm">
        <thead>
          <tr className={`text-left text-xs uppercase ${muted}`}>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colDistance')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colRange')}</th>
            <th className="py-1.5 pr-2 font-semibold">{t('predictions.colRecord')}</th>
            <th className="py-1.5 font-semibold">{t('predictions.colBase')}</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((prediction) => {
            const models = [prediction.riegelSec, prediction.cameronSec, prediction.vickersSec].filter(
              (v): v is number => v != null,
            )
            const low = Math.min(...models)
            const high = Math.max(...models)
            return (
              <tr key={prediction.label} className="border-t border-moss-200 dark:border-moss-750">
                <td className="py-2 pr-2 font-medium">{prediction.label}</td>
                <td className="py-2 pr-2 tabular-nums">
                  {formatChrono(low)} – {formatChrono(high)}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {prediction.recordSec != null ? formatChrono(prediction.recordSec) : '—'}
                </td>
                <td className={`py-2 text-xs ${muted}`}>{prediction.baseLabel}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
