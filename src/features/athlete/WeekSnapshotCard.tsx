import { useQuery } from '@tanstack/react-query'
import { addDays, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { ProgressRing, RING_COLORS } from '../../components/ProgressRing'
import { numberLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import { fetchCalendar, fetchPlanDetail, type WeekResponse } from '../calendar/api'
import type { AthleteHub } from './api'
import { formatHours } from './labels'

/**
 * The "am I on track this week?" card. With an active plan week it shows
 * completion rings — km, D+ and sessions against the week's targets, the
 * calendar's ring colors. Without a plan it falls back to the plain
 * done-so-far numbers.
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
  const weekEnd = thisWeek ? format(addDays(parseISO(thisWeek.weekStart), 6), 'yyyy-MM-dd') : ''
  const sessions = useQuery({
    queryKey: ['calendar', thisWeek?.weekStart, weekEnd],
    queryFn: () => fetchCalendar(thisWeek!.weekStart, weekEnd),
    enabled: !!currentSeason && !!thisWeek,
  })

  if (!thisWeek) return null

  const planWeek: WeekResponse | undefined = plan.data?.weeks.find(
    (w) => w.startDate === thisWeek.weekStart,
  )
  const targetKm = planWeek?.estimatedVolumeKm ?? planWeek?.targetVolumeKm ?? null
  const targetD = planWeek?.targetElevationM ?? null
  const sessionsPlanned = sessions.data?.length ?? 0
  const sessionsDone = sessions.data?.filter((s) => s.status === 'DONE').length ?? 0

  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('home.week.title')}</h2>
        {planWeek?.weekType && (
          <span className={`text-xs ${muted}`}>{t(`calendar:weekType.${planWeek.weekType}`)}</span>
        )}
      </div>
      {planWeek ? (
        <div className="mt-3 flex flex-wrap items-start justify-around gap-x-4 gap-y-3">
          <Ring
            actual={Math.round(Number(thisWeek.distanceKm))}
            target={targetKm != null ? Math.round(targetKm) : null}
            unit="km"
            label={t('calendar:header.metrics.volume')}
            color={RING_COLORS.volume}
          />
          <Ring
            actual={thisWeek.elevationM}
            target={targetD}
            unit="m"
            label={t('calendar:header.metrics.elevation')}
            color={RING_COLORS.elevation}
          />
          <Ring
            actual={sessionsDone}
            target={sessionsPlanned > 0 ? sessionsPlanned : null}
            unit=""
            label={t('home.week.sessions')}
            color={RING_COLORS.load}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric
            value={`${Math.round(Number(thisWeek.distanceKm))} km`}
            last={lastWeek ? `${Math.round(Number(lastWeek.distanceKm))} km` : null}
            lastLabel={t('home.week.lastWeek')}
          />
          <Metric
            value={`${thisWeek.elevationM.toLocaleString(numberLocale())} m D+`}
            last={lastWeek ? `${lastWeek.elevationM.toLocaleString(numberLocale())} m` : null}
            lastLabel={t('home.week.lastWeek')}
          />
        </div>
      )}
      <TimeSplit
        runMin={thisWeek.durationMin}
        gymMin={thisWeek.gymDurationMin}
        runLabel={t('home.week.runTime')}
        gymLabel={t('home.week.gymTime')}
      />
      {planWeek && lastWeek && (
        <p className={`mt-1 text-center text-xs ${muted}`}>
          {t('home.week.lastWeek')} {Math.round(Number(lastWeek.distanceKm))} km ·{' '}
          {lastWeek.elevationM.toLocaleString(numberLocale())} m D+ ·{' '}
          {formatHours(lastWeek.durationMin)}
        </p>
      )}
      {!currentSeason && <p className={`mt-2 text-xs ${muted}`}>{t('home.week.noPlan')}</p>}
    </section>
  )
}

/** Run time and strength time as two separate figures — never one merged total. */
function TimeSplit({
  runMin,
  gymMin,
  runLabel,
  gymLabel,
}: {
  runMin: number
  gymMin: number
  runLabel: string
  gymLabel: string
}) {
  return (
    <p className={`mt-3 text-center text-xs ${muted}`}>
      <span className="font-medium">{formatHours(runMin)}</span> {runLabel}
      {gymMin > 0 && (
        <>
          {' · '}
          <span className="font-medium">{formatHours(gymMin)}</span> {gymLabel}
        </>
      )}
    </p>
  )
}

/** One completion ring; without a target the ring stays unfilled and only the
 *  done-so-far value shows. */
function Ring({
  actual,
  target,
  unit,
  label,
  color,
}: {
  actual: number
  target: number | null
  unit: string
  label: string
  color: string
}) {
  const suffix = unit ? ` ${unit}` : ''
  return (
    <ProgressRing
      ratio={target ? actual / target : 0}
      size={76}
      strokeWidth={5}
      label={label}
      center={{
        value: actual.toLocaleString(numberLocale()),
        detail: target != null ? `/ ${target.toLocaleString(numberLocale())}${suffix}` : suffix.trim(),
      }}
      title={target != null ? `${actual}/${target}${suffix}` : `${actual}${suffix}`}
      className={color}
    />
  )
}

function Metric({
  value,
  last,
  lastLabel,
}: {
  value: string
  last: string | null
  lastLabel: string
}) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className={`mt-1 text-xs ${muted}`}>{last != null && `${lastLabel} ${last}`}</p>
    </div>
  )
}
