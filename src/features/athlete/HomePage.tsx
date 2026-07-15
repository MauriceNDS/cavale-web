import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, differenceInYears, format, parseISO } from 'date-fns'
import { Trans, useTranslation } from 'react-i18next'
import { dateLocale, numberLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { fetchMe } from '../auth/api'
import { createPlan } from '../calendar/api'
import { TodayCard } from '../calendar/TodayCard'
import { OBJECTIVE_TYPE_BADGE, formatTimeMin, objectiveTypeLabel } from '../objective/labels'
import {
  analyzeStravaRecords,
  fetchHub,
  fetchRunningStats,
  syncStravaHistory,
  type AthleteHub,
  type Season,
  type TrainingStatusLabel,
} from './api'
import { EffortChart, MonthlyBars, TrendLine } from './charts'
import { formatChrono, formatHours, formatPace } from './labels'

const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'
const muted = 'text-moss-500 dark:text-moss-400'
const pill = (active: boolean) =>
  `rounded-md px-3 py-1 text-xs font-medium transition ${
    active
      ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
      : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
  }`

export function HomePage() {
  const { t } = useTranslation('athlete')
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })

  if (hub.isLoading) {
    return <p className={`mt-16 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!hub.data) {
    return <p className={`mt-16 text-center ${muted}`}>{t('home.loadError')}</p>
  }
  return <HubContent hub={hub.data} />
}

function HubContent({ hub }: { hub: AthleteHub }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 pt-6">
      <TodayCard />
      <ProfileHeader hub={hub} />
      <ObjectivesRail seasons={hub.seasons} />
      <RecordsSection hub={hub} />
      <TrendsSection hub={hub} />
    </div>
  )
}

/* ── Profile header + Strava sync ──────────────────────────────────── */

function StatusChip() {
  const { t } = useTranslation('athlete')
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const user = me.data
  if (!user || user.athleteStatus === 'AVAILABLE') return null
  return (
    <Link
      to="/profil"
      className="inline-flex items-center gap-1.5 rounded-full bg-clay-100 px-3 py-1 text-xs font-semibold text-clay-600 transition hover:bg-clay-100/70 dark:bg-clay-900 dark:text-clay-300"
    >
      ⚠ {t(`home.status.${user.athleteStatus}`)}
      {user.statusSince &&
        ` ${t('home.status.since', {
          date: format(parseISO(user.statusSince), 'd MMMM', { locale: dateLocale() }),
        })}`}
      {user.statusNote && ` · ${user.statusNote}`}
    </Link>
  )
}

const TRAINING_STATUS_STYLE: Record<TrainingStatusLabel, string> = {
  PRODUCTIVE: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  MAINTAINING: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  RECOVERY: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  OVERREACHING: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
  DETRAINING: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
}

/** The single fused training-status verdict, glanceable over the metric wall. */
function TrainingStatusPill() {
  const { t } = useTranslation('athlete')
  const stats = useQuery({ queryKey: ['running-stats'], queryFn: fetchRunningStats })
  const status = stats.data?.trainingStatus
  if (!status) return null
  const trend = `${status.fitnessTrendPct > 0 ? '+' : ''}${status.fitnessTrendPct}%`
  return (
    <Link
      to="/stats"
      title={t(`home.trainingStatus.hint.${status.label}`)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80 ${TRAINING_STATUS_STYLE[status.label]}`}
    >
      {t(`home.trainingStatus.label.${status.label}`)}
      <span className="font-normal opacity-80">· {t('home.trainingStatus.trend', { value: trend })}</span>
    </Link>
  )
}

function ProfileHeader({ hub }: { hub: AthleteHub }) {
  const { t } = useTranslation('athlete')
  const { profile, totals } = hub
  const age = profile.birthDate ? differenceInYears(new Date(), parseISO(profile.birthDate)) : null
  const details = [
    age != null && t('home.profile.age', { count: age }),
    profile.weightKg != null && `${profile.weightKg} kg`,
    profile.heightCm != null && `${profile.heightCm} cm`,
    profile.maxHr != null && t('home.profile.maxHr', { value: profile.maxHr }),
    profile.restingHr != null && t('home.profile.restingHr', { value: profile.restingHr }),
  ].filter(Boolean) as string[]

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{profile.displayName}</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {details.length > 0 ? details.join(' · ') : t('home.profile.completeProfile')}
            {' · '}
            <Link to="/profil" className="text-pine-700 underline dark:text-pine-300">
              {t('home.profile.edit')}
            </Link>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TrainingStatusPill />
            <StatusChip />
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xl font-semibold">
              {Math.round(totals.year.distanceKm).toLocaleString(numberLocale())} km
            </p>
            <p className={`text-xs ${muted}`}>{t('home.profile.yearTotal', { count: totals.year.runs })}</p>
          </div>
          <div>
            <p className="text-xl font-semibold">
              {Math.round(totals.allTime.distanceKm).toLocaleString(numberLocale())} km
            </p>
            <p className={`text-xs ${muted}`}>{t('home.profile.allTimeTotal', { count: totals.allTime.runs })}</p>
          </div>
        </div>
      </div>
      <SyncCard sync={hub.sync} />
    </section>
  )
}

function SyncCard({ sync }: { sync: AthleteHub['sync'] }) {
  const { t } = useTranslation('athlete')
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<string | null>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hub'] })

  const syncMutation = useMutation({
    mutationFn: syncStravaHistory,
    onSuccess: (result) => {
      setProgress(
        t('home.sync.progress', {
          imported: result.imported,
          updated: result.updated,
          total: result.totalRuns,
        }),
      )
      invalidate()
    },
  })

  const analyzeMutation = useMutation({
    mutationFn: analyzeStravaRecords,
    onSuccess: (result) => {
      if (result.remaining > 0 && result.analyzed > 0) {
        setProgress(t('home.sync.analyzing', { count: result.remaining }))
        analyzeMutation.mutate() // next batch, until done or rate-limited
      } else {
        setProgress(result.remaining === 0 ? t('home.sync.upToDate') : t('home.sync.rateLimited'))
        invalidate()
      }
    },
  })

  if (!sync.stravaConnected) {
    return (
      <p className={`mt-4 border-t border-moss-200 pt-3 text-sm dark:border-moss-750 ${muted}`}>
        <Trans
          i18nKey="home.sync.connectPrompt"
          ns="athlete"
          components={[
            <Link key="settings" to="/parametres" className="text-pine-700 underline dark:text-pine-300" />,
          ]}
        />
      </p>
    )
  }

  const busy = syncMutation.isPending || analyzeMutation.isPending
  const error = syncMutation.error ?? analyzeMutation.error

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-moss-200 pt-3 dark:border-moss-750">
      <p className={`text-sm ${muted}`}>
        {t('home.sync.synced', {
          count: sync.syncedActivities,
          formatted: sync.syncedActivities.toLocaleString(numberLocale()),
        })}
        {sync.recordsPending > 0 && ` · ${t('home.sync.toAnalyze', { count: sync.recordsPending })}`}
      </p>
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={busy}
          className="rounded-lg bg-moss-100 px-3 py-1.5 text-sm font-medium transition hover:bg-moss-200 disabled:opacity-50 dark:bg-moss-800 dark:hover:bg-moss-750"
        >
          {syncMutation.isPending ? t('home.sync.syncing') : t('home.sync.syncButton')}
        </button>
        {sync.recordsPending > 0 && (
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={busy}
            className="rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {analyzeMutation.isPending ? t('home.sync.analyzeBusy') : t('home.sync.analyzeButton')}
          </button>
        )}
      </div>
      {progress && <p className={`w-full text-xs ${muted}`}>{progress}</p>}
      {error instanceof ApiError && (
        <p role="alert" className="w-full text-xs text-clay-500 dark:text-clay-300">
          {error.message}
        </p>
      )}
    </div>
  )
}

/* ── Objectives: past / current / next ─────────────────────────────── */

function ObjectivesRail({ seasons }: { seasons: Season[] }) {
  const { t } = useTranslation('athlete')
  const past = seasons.filter((s) => s.timeframe === 'PAST')
  const current = seasons.find((s) => s.timeframe === 'CURRENT')
  const future = seasons.filter((s) => s.timeframe === 'FUTURE')
  // On mobile only the current season shows by default — past/future columns
  // (often empty states) otherwise eat the first screen.
  const [showAll, setShowAll] = useState(false)
  const hiddenColumn = showAll ? '' : 'hidden md:block'

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">{t('home.objectives.title')}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className={hiddenColumn}>
          <ObjectiveColumn title={t('home.objectives.past')}>
            {past.length === 0 && <EmptyNote>{t('home.objectives.noPast')}</EmptyNote>}
            {past
              .slice()
              .reverse()
              .map((season) => (
                <SeasonCard key={season.planId} season={season} />
              ))}
          </ObjectiveColumn>
        </div>
        <div className="order-first md:order-none">
          <ObjectiveColumn title={t('home.objectives.current')} highlight>
            {current ? (
              <SeasonCard season={current} showLink />
            ) : (
              <EmptyNote>{t('home.objectives.noActive')}</EmptyNote>
            )}
          </ObjectiveColumn>
        </div>
        <div className={hiddenColumn}>
          <ObjectiveColumn title={t('home.objectives.upcoming')}>
            {future.map((season) => (
              <SeasonCard key={season.planId} season={season} />
            ))}
            <NextObjectiveForm hasFuture={future.length > 0} />
          </ObjectiveColumn>
        </div>
      </div>
      <button
        onClick={() => setShowAll(!showAll)}
        className="mt-3 text-sm font-medium text-pine-700 hover:underline md:hidden dark:text-pine-300"
      >
        {showAll ? t('home.objectives.hideAll') : t('home.objectives.showAll')}
      </button>
    </section>
  )
}

function ObjectiveColumn({ title, highlight, children }: { title: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`h-full rounded-lg border p-3 ${
        highlight
          ? 'border-pine-600/40 bg-pine-100/40 dark:border-pine-350/40 dark:bg-pine-900/30'
          : 'border-moss-200 bg-moss-50 dark:border-moss-750 dark:bg-moss-900'
      }`}
    >
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className={`text-sm ${muted}`}>{children}</p>
}

function SeasonCard({ season, showLink }: { season: Season; showLink?: boolean }) {
  const { t } = useTranslation('athlete')
  const objective = season.objective
  const date = objective?.date ?? season.endDate
  const days = differenceInCalendarDays(parseISO(date), new Date())

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
          ` · ${t('home.objectives.doneChip', { time: formatTimeMin(objective.resultTimeMin) })}`}
        {objective?.resultTimeMin == null &&
          objective?.targetTimeMin != null &&
          ` · ${t('home.objectives.targetChip', { time: formatTimeMin(objective.targetTimeMin) })}`}
      </p>
      {season.timeframe === 'CURRENT' && days >= 0 && (
        <p className="mt-1 font-display text-xl font-semibold text-pine-700 dark:text-pine-300">
          {t('home.objectives.countdown', { count: days })}
        </p>
      )}
      {showLink && (
        <Link
          to="/objectif"
          className="mt-1 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300"
        >
          {t('home.objectives.seeProgress')}
        </Link>
      )}
    </div>
  )
}

/** Plan the next season: creates a DRAFT plan whose MAIN objective is the goal. */
function NextObjectiveForm({ hasFuture }: { hasFuture: boolean }) {
  const { t } = useTranslation('athlete')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub'] })
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full rounded-lg border border-dashed border-moss-300 px-3 py-2 text-sm font-medium ${muted} transition hover:border-pine-600 hover:text-pine-700 dark:border-moss-700 dark:hover:border-pine-350 dark:hover:text-pine-300`}
      >
        {hasFuture ? t('home.objectives.addAnother') : t('home.objectives.addFirst')}
      </button>
    )
  }

  const fieldClass =
    'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  return (
    <form
      className="space-y-2 rounded-lg border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        mutation.mutate({
          name: (data.get('name') as string).trim(),
          goal: ((data.get('goal') as string) || '').trim() || undefined,
          startDate: data.get('startDate') as string,
          endDate: data.get('endDate') as string,
        })
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">{t('home.objectives.form.seasonName')}</span>
        <input
          name="name"
          required
          maxLength={150}
          placeholder={t('home.objectives.form.seasonPlaceholder')}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t('home.objectives.form.goal')}</span>
        <input
          name="goal"
          maxLength={500}
          placeholder={t('home.objectives.form.goalPlaceholder')}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm font-medium">{t('home.objectives.form.start')}</span>
          <input name="startDate" type="date" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('home.objectives.form.end')}</span>
          <input name="endDate" type="date" required className={fieldClass} />
        </label>
      </div>
      {mutation.error instanceof ApiError && (
        <p role="alert" className="text-xs text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {mutation.isPending ? t('common:creating') : t('common:create')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`px-3 py-1.5 text-sm font-medium ${muted}`}>
          {t('common:cancel')}
        </button>
      </div>
    </form>
  )
}

/* ── Records, longest runs, estimations ────────────────────────────── */

function RecordsSection({ hub }: { hub: AthleteHub }) {
  const { t } = useTranslation('athlete')
  const { records, longestRuns, predictions, sync } = hub

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">{t('home.records.title')}</h2>
      {records.length === 0 ? (
        <p className={`mt-2 text-sm ${muted}`}>
          {sync.stravaConnected
            ? sync.recordsPending > 0
              ? t('home.records.emptyAnalyze')
              : t('home.records.emptySync')
            : t('home.records.emptyConnect')}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {records.map((record) => (
            <div key={record.label} className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>{record.label}</p>
              <p className="mt-0.5 text-xl font-semibold">{formatChrono(record.seconds)}</p>
              <p className={`mt-0.5 text-xs ${muted}`}>
                {formatPace(Math.round((record.seconds * 1000) / record.distanceM))} ·{' '}
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
              <p className={`text-xs ${muted}`}>{t('home.records.longestByDistance')}</p>
              <p className="mt-0.5 text-xl font-semibold">{longestRuns.byDistance.distanceKm} km</p>
              <p className={`mt-0.5 truncate text-xs ${muted}`}>
                {longestRuns.byDistance.name ?? t('home.records.runFallback')} ·{' '}
                {format(parseISO(longestRuns.byDistance.date), 'd MMM yyyy', { locale: dateLocale() })}
              </p>
            </div>
          )}
          {longestRuns.byDuration && (
            <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>{t('home.records.longestByDuration')}</p>
              <p className="mt-0.5 text-xl font-semibold">
                {formatHours(longestRuns.byDuration.durationMin)}
                <span className="text-sm font-normal"> ({formatChrono(longestRuns.byDuration.durationMin * 60)})</span>
              </p>
              <p className={`mt-0.5 truncate text-xs ${muted}`}>
                {longestRuns.byDuration.name ?? t('home.records.runFallback')} ·{' '}
                {format(parseISO(longestRuns.byDuration.date), 'd MMM yyyy', { locale: dateLocale() })}
              </p>
            </div>
          )}
        </div>
      )}

      {predictions.length > 0 && (
        <>
          <h3 className="mt-5 font-display text-base font-semibold">{t('home.records.estimatesTitle')}</h3>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('home.records.estimatesIntro')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {predictions.map((prediction) => (
              <div key={prediction.label} className="rounded-lg border border-dashed border-moss-300 p-3 dark:border-moss-700">
                <p className={`text-xs ${muted}`}>{prediction.label}</p>
                <p className="mt-0.5 text-xl font-semibold">{formatChrono(prediction.seconds)}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {formatPace(prediction.paceSecPerKm)} · {t('home.records.basedOn', { record: prediction.basedOn })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/* ── Trends: volume, pace/HR/cadence, relative effort ──────────────── */

type VolumeMetric = 'km' | 'dplus'
type TrendMetric = 'pace' | 'hr' | 'cadence'

function TrendsSection({ hub }: { hub: AthleteHub }) {
  const { t } = useTranslation('athlete')
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('km')
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('pace')
  const { monthly, weeklyEffort, totals } = hub

  const trend = {
    pace: {
      label: t('home.trends.avgPace'),
      value: (m: (typeof monthly)[number]) => m.avgPaceSecPerKm,
      format: (v: number) => formatPace(v),
      tick: (v: number) => formatPace(v).replace('/km', ''),
      invert: true,
    },
    hr: {
      label: t('home.trends.avgHr'),
      value: (m: (typeof monthly)[number]) => m.avgHr,
      format: (v: number) => `${Math.round(v)} bpm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
    cadence: {
      label: t('home.trends.avgCadence'),
      value: (m: (typeof monthly)[number]) => m.avgCadenceSpm,
      format: (v: number) => `${Math.round(v)} spm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
  }[trendMetric]

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('home.trends.volumeTitle')}</h2>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          <button onClick={() => setVolumeMetric('km')} className={pill(volumeMetric === 'km')}>
            {t('home.trends.distanceKm')}
          </button>
          <button onClick={() => setVolumeMetric('dplus')} className={pill(volumeMetric === 'dplus')}>
            {t('home.trends.elevationM')}
          </button>
        </div>
      </div>
      <p className={`mt-1 text-xs ${muted}`}>
        {t('home.trends.yearSummary', {
          duration: formatHours(totals.year.durationMin),
          elevation: totals.year.elevationM.toLocaleString(numberLocale()),
        })}
      </p>
      <div className="mt-3">
        <MonthlyBars
          months={monthly}
          value={(m) => (volumeMetric === 'km' ? Math.round(m.distanceKm) : m.elevationM)}
          unit={volumeMetric === 'km' ? 'km' : 'm D+'}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('home.trends.evolutionTitle')}</h2>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          <button onClick={() => setTrendMetric('pace')} className={pill(trendMetric === 'pace')}>
            {t('home.trends.pace')}
          </button>
          <button onClick={() => setTrendMetric('hr')} className={pill(trendMetric === 'hr')}>
            {t('home.trends.hr')}
          </button>
          <button onClick={() => setTrendMetric('cadence')} className={pill(trendMetric === 'cadence')}>
            {t('home.trends.cadence')}
          </button>
        </div>
      </div>
      {trendMetric === 'pace' && (
        <p className={`mt-1 text-xs ${muted}`}>{t('home.trends.invertedAxis')}</p>
      )}
      <div className="mt-3">
        <TrendLine
          months={monthly}
          value={trend.value}
          formatValue={trend.format}
          formatTick={trend.tick}
          invert={trend.invert}
          label={trend.label}
        />
      </div>

      <h2 className="mt-6 font-display text-lg font-semibold">{t('home.trends.effortTitle')}</h2>
      <p className={`mt-1 text-xs ${muted}`}>{t('home.trends.effortIntro')}</p>
      <div className="mt-3">
        <EffortChart weeks={weeklyEffort} />
      </div>
    </section>
  )
}
