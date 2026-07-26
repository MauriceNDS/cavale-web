import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import {
  ChartSurface,
  gappedLinePath,
  GridY,
  linearY,
  niceTicks,
  pointX,
  TooltipLines,
  XLabels,
} from '../../components/chartkit'
import { fetchExerciseHistory } from './api'

function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

/**
 * One lift, all of it.
 *
 * The aggregate stats can say which lifts are moving; this is where you
 * find out why one of them stopped — every session, the sets as actually
 * performed (warm-ups included, because the ramp is part of the story),
 * and how long the estimated max has been standing still.
 */
export function ExerciseHistoryPage() {
  const { t } = useTranslation('gym')
  const params = useParams({ strict: false }) as { exerciseId?: string }
  const exerciseId = params.exerciseId!

  const query = useQuery({
    queryKey: ['exercise-history', exerciseId],
    queryFn: () => fetchExerciseHistory(exerciseId),
  })

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  const history = query.data
  if (!history) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('history.notFound')}</p>
    )
  }

  const stalled = history.sessionsSinceProgress
  const points = history.oneRmTrend

  return (
    <div className="mx-auto mt-6 max-w-3xl pb-10">
      <Link
        to="/stats"
        search={{ tab: 'renfo' }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
      >
        {t('history.back')}
      </Link>

      <h1 className="mt-2 font-display text-2xl font-semibold">{history.name}</h1>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={history.bestWeightKg != null ? `${kg(history.bestWeightKg)} kg` : '—'}
          label={t('history.bestWeight')} />
        <Stat value={history.bestOneRmKg != null ? `${kg(history.bestOneRmKg)} kg` : '—'}
          label={t('history.bestOneRm')} />
        <Stat value={String(history.sessions.length)} label={t('history.sessionCount')} />
        <Stat value={String(history.totalSets)} label={t('history.setCount')} />
      </div>

      {/* the thing worth acting on: a lift that has stopped moving */}
      {stalled != null && stalled >= 3 && (
        <p className="mt-3 rounded-xl border border-copper-600/40 bg-copper-600/5 p-3 text-sm text-copper-600 dark:border-copper-300/40 dark:bg-copper-300/10 dark:text-copper-300">
          {t('history.stalled', { count: stalled })}
        </p>
      )}

      {points.length > 1 && (
        <section className={`${card} mt-3`}>
          <h2 className="font-display text-lg font-semibold">{t('history.trendTitle')}</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('history.trendHint')}</p>
          <div className="mt-3">
            <ChartSurface
              ariaLabel={t('history.trendAria', { name: history.name })}
              count={points.length}
              crosshair
              xFor={(i, frame) => pointX(frame, points.length)(i)}
              tooltip={(i) => (
                <TooltipLines
                  lines={[
                    format(parseISO(points[i].date), 'd MMMM yyyy', { locale: dateLocale() }),
                    t('history.oneRmValue', { value: kg(points[i].estOneRmKg) }),
                  ]}
                />
              )}
            >
              {(frame) => {
                const values = points.map((p) => p.estOneRmKg)
                const lo = Math.min(...values) * 0.95
                const hi = Math.max(...values) * 1.05 || 1
                const y = linearY(frame, lo, hi)
                const x = pointX(frame, points.length)
                return (
                  <>
                    <GridY frame={frame} ticks={niceTicks(hi).filter((v) => v > lo && v < hi)} y={y} />
                    <path
                      d={gappedLinePath(x, y, points.map((p) => p.estOneRmKg))}
                      fill="none"
                      strokeWidth={2}
                      className="stroke-copper-600 dark:stroke-copper-300"
                    />
                    {points.map((p, i) => (
                      <circle key={p.date} cx={x(i)} cy={y(p.estOneRmKg)} r={3}
                        className="fill-copper-600 dark:fill-copper-300" />
                    ))}
                    <XLabels
                      frame={frame}
                      count={points.length}
                      x={x}
                      step={Math.max(1, Math.ceil(points.length / 4))}
                      label={(i) => format(parseISO(points[i].date), 'd MMM', { locale: dateLocale() })}
                    />
                  </>
                )
              }}
            </ChartSurface>
          </div>
        </section>
      )}

      <h2 className="mt-5 font-display text-lg font-semibold">{t('history.sessionsTitle')}</h2>
      {history.sessions.length === 0 && (
        <p className={`mt-3 text-sm ${muted}`}>{t('history.noSessions')}</p>
      )}
      <div className="mt-2 space-y-2">
        {history.sessions.map((session) => (
          <article
            key={session.workoutLogId}
            className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <p className="font-medium">
                {format(parseISO(session.date), 'EEEE d MMMM yyyy', { locale: dateLocale() })}
              </p>
              {session.estOneRmKg != null && (
                <p className="text-sm font-semibold text-copper-600 tabular-nums dark:text-copper-300">
                  {t('history.estimated', { value: kg(session.estOneRmKg) })}
                </p>
              )}
            </div>
            {session.templateName && (
              <p className={`text-xs ${muted}`}>{session.templateName}</p>
            )}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {session.sets.map((set) => (
                <li
                  key={set.setNumber}
                  className={`rounded-lg px-2 py-1 text-xs tabular-nums ${
                    set.warmup
                      ? `bg-moss-100 ${muted} dark:bg-moss-800`
                      : 'bg-copper-600/10 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300'
                  }`}
                >
                  {set.seconds != null
                    ? `${set.seconds}s`
                    : `${set.weightKg != null ? kg(set.weightKg) : '—'} × ${set.reps ?? '—'}`}
                  {set.rir != null && <span className="opacity-70"> · RIR {set.rir}</span>}
                  {set.warmup && <span className="opacity-70"> · {t('workout.warmupShort')}</span>}
                </li>
              ))}
            </ul>
            {session.tonnageKg > 0 && (
              <p className={`mt-1.5 text-xs ${muted}`}>
                {t('history.sessionTonnage', { value: Math.round(session.tonnageKg) })}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-moss-200 bg-moss-25 px-3 py-2.5 text-center dark:border-moss-750 dark:bg-moss-850">
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
      <p className={`text-[11px] ${muted}`}>{label}</p>
    </div>
  )
}
