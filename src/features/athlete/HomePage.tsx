import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, differenceInYears, format, parseISO } from 'date-fns'
import { Trans, useTranslation } from 'react-i18next'
import { ProgressRing, RING_COLORS } from '../../components/ProgressRing'
import { dateLocale, numberLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { card, muted } from '../../lib/ui'
import { fetchMe } from '../auth/api'
import { TodayCard } from '../calendar/TodayCard'
import { CoachCard } from '../coach/CoachCard'
import { OBJECTIVE_TYPE_BADGE, objectiveTypeLabel } from '../objective/labels'
import {
  analyzeStravaRecords,
  fetchHub,
  fetchRunningStats,
  syncStravaHistory,
  type AthleteHub,
  type Season,
  type TrainingStatusLabel,
} from './api'
import { WeekSnapshotCard } from './WeekSnapshotCard'

// Safety cap on the self-chaining analyze drain: a backend that never reports
// remaining === 0 must not spin up requests forever.
const MAX_ANALYZE_BATCHES = 25

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
      <WeekSnapshotCard hub={hub} />
      <CoachCard />
      <NextObjectiveCard seasons={hub.seasons} />
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
  const stats = useQuery({ queryKey: ['running-stats'], queryFn: () => fetchRunningStats() })
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
  const analyzeBatches = useRef(0)
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
      // Chain the next batch only while progress is being made AND we're under
      // the safety cap; otherwise stop and let the athlete re-trigger.
      if (
        result.remaining > 0 &&
        result.analyzed > 0 &&
        analyzeBatches.current < MAX_ANALYZE_BATCHES
      ) {
        analyzeBatches.current += 1
        setProgress(t('home.sync.analyzing', { count: result.remaining }))
        analyzeMutation.mutate() // next batch, until done, rate-limited or capped
      } else {
        analyzeBatches.current = 0
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
            onClick={() => {
              analyzeBatches.current = 0
              analyzeMutation.mutate()
            }}
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

/* ── Next objective: the one-glance season card ────────────────────── */

/**
 * Compact pointer to the Objectif page: the current season's race (or the
 * next planned one), its date, the D-countdown inside a ring showing how far
 * into the season we are. Management lives on /objectif.
 */
function NextObjectiveCard({ seasons }: { seasons: Season[] }) {
  const { t } = useTranslation('athlete')
  const season =
    seasons.find((s) => s.timeframe === 'CURRENT') ??
    seasons.filter((s) => s.timeframe === 'FUTURE').sort((a, b) => a.endDate.localeCompare(b.endDate))[0]

  if (!season) {
    return (
      <section className={card}>
        <h2 className="font-display text-lg font-semibold">{t('home.next.title')}</h2>
        <p className={`mt-2 text-sm ${muted}`}>{t('home.next.none')}</p>
        <Link
          to="/objectif"
          className="mt-1 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300"
        >
          {t('home.next.create')}
        </Link>
      </section>
    )
  }

  const objective = season.objective
  const date = objective?.date ?? season.endDate
  const days = differenceInCalendarDays(parseISO(date), new Date())
  const seasonDays = Math.max(
    differenceInCalendarDays(parseISO(season.endDate), parseISO(season.startDate)),
    1,
  )
  const elapsed = Math.min(
    Math.max(differenceInCalendarDays(new Date(), parseISO(season.startDate)) / seasonDays, 0),
    1,
  )

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{t('home.next.title')}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="font-medium">{objective?.name ?? season.planName}</p>
            {objective && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_TYPE_BADGE[objective.type]}`}>
                {objectiveTypeLabel(objective.type)}
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-sm ${muted}`}>
            {format(parseISO(date), 'EEEE d MMMM yyyy', { locale: dateLocale() })}
            {objective?.distanceKm != null && ` · ${objective.distanceKm} km`}
            {objective?.elevationGainM != null &&
              ` · ${objective.elevationGainM.toLocaleString(numberLocale())} m D+`}
          </p>
          <Link
            to="/objectif"
            className="mt-2 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('home.next.seeProgress')}
          </Link>
        </div>
        {days >= 0 && (
          <ProgressRing
            ratio={season.timeframe === 'CURRENT' ? elapsed : 0}
            size={76}
            strokeWidth={5}
            label={t('home.next.ringLabel')}
            center={{
              value: t('home.next.countdown', { count: days }),
              detail: format(parseISO(date), 'd MMM', { locale: dateLocale() }),
            }}
            className={RING_COLORS.volume}
          />
        )}
      </div>
    </section>
  )
}
