import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, differenceInYears, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ApiError } from '../../lib/api'
import { fetchMe } from '../auth/api'
import { createPlan } from '../calendar/api'
import { TodayCard } from '../calendar/TodayCard'
import { OBJECTIVE_TYPE_BADGE, OBJECTIVE_TYPE_LABEL, formatTimeMin } from '../objective/labels'
import {
  analyzeStravaRecords,
  fetchHub,
  syncStravaHistory,
  type AthleteHub,
  type Season,
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
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })

  if (hub.isLoading) {
    return <p className={`mt-16 text-center ${muted}`}>Chargement…</p>
  }
  if (!hub.data) {
    return <p className={`mt-16 text-center ${muted}`}>Impossible de charger le tableau de bord.</p>
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

const STATUS_CHIP: Record<string, string> = {
  INJURED: 'Blessé',
  RECOVERING: 'Reprise',
  SICK: 'Malade',
}

function StatusChip() {
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const user = me.data
  if (!user || user.athleteStatus === 'AVAILABLE') return null
  return (
    <Link
      to="/settings"
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-clay-100 px-3 py-1 text-xs font-semibold text-clay-600 transition hover:bg-clay-100/70 dark:bg-clay-900 dark:text-clay-300"
    >
      ⚠ {STATUS_CHIP[user.athleteStatus]}
      {user.statusSince &&
        ` depuis le ${format(parseISO(user.statusSince), 'd MMMM', { locale: fr })}`}
      {user.statusNote && ` · ${user.statusNote}`}
    </Link>
  )
}

function ProfileHeader({ hub }: { hub: AthleteHub }) {
  const { profile, totals } = hub
  const age = profile.birthDate ? differenceInYears(new Date(), parseISO(profile.birthDate)) : null
  const details = [
    age != null && `${age} ans`,
    profile.weightKg != null && `${profile.weightKg} kg`,
    profile.heightCm != null && `${profile.heightCm} cm`,
    profile.maxHr != null && `FC max ${profile.maxHr}`,
    profile.restingHr != null && `FC repos ${profile.restingHr}`,
  ].filter(Boolean) as string[]

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{profile.displayName}</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {details.length > 0 ? details.join(' · ') : 'Complète ton profil dans les réglages'}
            {' · '}
            <Link to="/settings" className="text-pine-700 underline dark:text-pine-300">
              modifier
            </Link>
          </p>
          <StatusChip />
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xl font-semibold">
              {Math.round(totals.year.distanceKm).toLocaleString('fr-FR')} km
            </p>
            <p className={`text-xs ${muted}`}>cette année · {totals.year.runs} sorties</p>
          </div>
          <div>
            <p className="text-xl font-semibold">
              {Math.round(totals.allTime.distanceKm).toLocaleString('fr-FR')} km
            </p>
            <p className={`text-xs ${muted}`}>au total · {totals.allTime.runs} sorties</p>
          </div>
        </div>
      </div>
      <SyncCard sync={hub.sync} />
    </section>
  )
}

function SyncCard({ sync }: { sync: AthleteHub['sync'] }) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<string | null>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hub'] })

  const syncMutation = useMutation({
    mutationFn: syncStravaHistory,
    onSuccess: (result) => {
      setProgress(`${result.imported} importées, ${result.updated} mises à jour (${result.totalRuns} courses)`)
      invalidate()
    },
  })

  const analyzeMutation = useMutation({
    mutationFn: analyzeStravaRecords,
    onSuccess: (result) => {
      if (result.remaining > 0 && result.analyzed > 0) {
        setProgress(`Analyse… ${result.remaining} restantes`)
        analyzeMutation.mutate() // next batch, until done or rate-limited
      } else {
        setProgress(result.remaining === 0 ? 'Records à jour ✓' : 'Limite Strava atteinte — réessaie dans 15 min')
        invalidate()
      }
    },
  })

  if (!sync.stravaConnected) {
    return (
      <p className={`mt-4 border-t border-moss-200 pt-3 text-sm dark:border-moss-750 ${muted}`}>
        Connecte Strava dans les{' '}
        <Link to="/settings" className="text-pine-700 underline dark:text-pine-300">
          réglages
        </Link>{' '}
        pour importer ton historique, tes records et ton effort relatif.
      </p>
    )
  }

  const busy = syncMutation.isPending || analyzeMutation.isPending
  const error = syncMutation.error ?? analyzeMutation.error

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-moss-200 pt-3 dark:border-moss-750">
      <p className={`text-sm ${muted}`}>
        Strava : {sync.syncedActivities.toLocaleString('fr-FR')} activités synchronisées
        {sync.recordsPending > 0 && ` · ${sync.recordsPending} à analyser`}
      </p>
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={busy}
          className="rounded-lg bg-moss-100 px-3 py-1.5 text-sm font-medium transition hover:bg-moss-200 disabled:opacity-50 dark:bg-moss-800 dark:hover:bg-moss-750"
        >
          {syncMutation.isPending ? 'Synchronisation…' : "Synchroniser l'historique"}
        </button>
        {sync.recordsPending > 0 && (
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={busy}
            className="rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {analyzeMutation.isPending ? 'Analyse…' : 'Analyser les records'}
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
  const past = seasons.filter((s) => s.timeframe === 'PAST')
  const current = seasons.find((s) => s.timeframe === 'CURRENT')
  const future = seasons.filter((s) => s.timeframe === 'FUTURE')
  // On mobile only the current season shows by default — past/future columns
  // (often empty states) otherwise eat the first screen.
  const [showAll, setShowAll] = useState(false)
  const hiddenColumn = showAll ? '' : 'hidden md:block'

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">Objectifs</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className={hiddenColumn}>
          <ObjectiveColumn title="Passés">
            {past.length === 0 && <EmptyNote>Aucune saison terminée.</EmptyNote>}
            {past
              .slice()
              .reverse()
              .map((season) => (
                <SeasonCard key={season.planId} season={season} />
              ))}
          </ObjectiveColumn>
        </div>
        <div className="order-first md:order-none">
          <ObjectiveColumn title="En cours" highlight>
            {current ? (
              <SeasonCard season={current} showLink />
            ) : (
              <EmptyNote>Aucun plan actif — importe ou crée ton plan.</EmptyNote>
            )}
          </ObjectiveColumn>
        </div>
        <div className={hiddenColumn}>
          <ObjectiveColumn title="À venir">
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
        {showAll ? 'Masquer passés & à venir' : 'Voir passés & à venir'}
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
  const objective = season.objective
  const date = objective?.date ?? season.endDate
  const days = differenceInCalendarDays(parseISO(date), new Date())

  return (
    <div className="rounded-lg border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{objective?.name ?? season.planName}</p>
        {objective && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_TYPE_BADGE[objective.type]}`}>
            {OBJECTIVE_TYPE_LABEL[objective.type]}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-sm ${muted}`}>
        {format(parseISO(date), 'd MMM yyyy', { locale: fr })}
        {objective?.distanceKm != null && ` · ${objective.distanceKm} km`}
        {objective?.resultTimeMin != null && ` · réalisé ${formatTimeMin(objective.resultTimeMin)}`}
        {objective?.resultTimeMin == null && objective?.targetTimeMin != null && ` · visé ${formatTimeMin(objective.targetTimeMin)}`}
      </p>
      {season.timeframe === 'CURRENT' && days >= 0 && (
        <p className="mt-1 font-display text-xl font-semibold text-pine-700 dark:text-pine-300">
          J−{days}
        </p>
      )}
      {showLink && (
        <Link
          to="/objectif"
          className="mt-1 inline-block text-sm font-medium text-pine-700 underline dark:text-pine-300"
        >
          Voir la progression
        </Link>
      )}
    </div>
  )
}

/** Plan the next season: creates a DRAFT plan whose MAIN objective is the goal. */
function NextObjectiveForm({ hasFuture }: { hasFuture: boolean }) {
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
        {hasFuture ? '+ Autre objectif futur' : '+ Définir le prochain objectif'}
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
        <span className="text-sm font-medium">Nom de la saison</span>
        <input name="name" required maxLength={150} placeholder="Saison UTMB 2027" className={fieldClass} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Objectif</span>
        <input name="goal" maxLength={500} placeholder="UTMB 100 km" className={fieldClass} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm font-medium">Début</span>
          <input name="startDate" type="date" required className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Fin</span>
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
          {mutation.isPending ? 'Création…' : 'Créer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`px-3 py-1.5 text-sm font-medium ${muted}`}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/* ── Records, longest runs, estimations ────────────────────────────── */

function RecordsSection({ hub }: { hub: AthleteHub }) {
  const { records, longestRuns, predictions, sync } = hub

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">Records</h2>
      {records.length === 0 ? (
        <p className={`mt-2 text-sm ${muted}`}>
          {sync.stravaConnected
            ? sync.recordsPending > 0
              ? 'Lance « Analyser les records » ci-dessus pour extraire tes meilleurs temps.'
              : "Synchronise ton historique Strava pour découvrir tes records."
            : 'Connecte Strava pour découvrir tes records de distance.'}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {records.map((record) => (
            <div key={record.label} className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>{record.label}</p>
              <p className="mt-0.5 text-xl font-semibold">{formatChrono(record.seconds)}</p>
              <p className={`mt-0.5 text-xs ${muted}`}>
                {formatPace(Math.round((record.seconds * 1000) / record.distanceM))} ·{' '}
                {format(parseISO(record.date), 'MMM yyyy', { locale: fr })}
              </p>
            </div>
          ))}
        </div>
      )}

      {(longestRuns.byDistance || longestRuns.byDuration) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {longestRuns.byDistance && (
            <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>Plus longue sortie (distance)</p>
              <p className="mt-0.5 text-xl font-semibold">{longestRuns.byDistance.distanceKm} km</p>
              <p className={`mt-0.5 truncate text-xs ${muted}`}>
                {longestRuns.byDistance.name ?? 'Sortie'} ·{' '}
                {format(parseISO(longestRuns.byDistance.date), 'd MMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          {longestRuns.byDuration && (
            <div className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900">
              <p className={`text-xs ${muted}`}>Plus longue sortie (durée)</p>
              <p className="mt-0.5 text-xl font-semibold">
                {formatHours(longestRuns.byDuration.durationMin)}
                <span className="text-sm font-normal"> ({formatChrono(longestRuns.byDuration.durationMin * 60)})</span>
              </p>
              <p className={`mt-0.5 truncate text-xs ${muted}`}>
                {longestRuns.byDuration.name ?? 'Sortie'} ·{' '}
                {format(parseISO(longestRuns.byDuration.date), 'd MMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
        </div>
      )}

      {predictions.length > 0 && (
        <>
          <h3 className="mt-5 font-display text-base font-semibold">Temps estimés</h3>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Estimations (formule de Riegel) d'après tes records — pas des résultats.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {predictions.map((prediction) => (
              <div key={prediction.label} className="rounded-lg border border-dashed border-moss-300 p-3 dark:border-moss-700">
                <p className={`text-xs ${muted}`}>{prediction.label}</p>
                <p className="mt-0.5 text-xl font-semibold">{formatChrono(prediction.seconds)}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {formatPace(prediction.paceSecPerKm)} · d'après ton {prediction.basedOn}
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
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('km')
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('pace')
  const { monthly, weeklyEffort, totals } = hub

  const trend = {
    pace: {
      label: 'Allure moyenne',
      value: (m: (typeof monthly)[number]) => m.avgPaceSecPerKm,
      format: (v: number) => formatPace(v),
      tick: (v: number) => formatPace(v).replace('/km', ''),
      invert: true,
    },
    hr: {
      label: 'FC moyenne',
      value: (m: (typeof monthly)[number]) => m.avgHr,
      format: (v: number) => `${Math.round(v)} bpm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
    cadence: {
      label: 'Cadence moyenne',
      value: (m: (typeof monthly)[number]) => m.avgCadenceSpm,
      format: (v: number) => `${Math.round(v)} spm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
  }[trendMetric]

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Volume mensuel</h2>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          <button onClick={() => setVolumeMetric('km')} className={pill(volumeMetric === 'km')}>
            Distance (km)
          </button>
          <button onClick={() => setVolumeMetric('dplus')} className={pill(volumeMetric === 'dplus')}>
            D+ (m)
          </button>
        </div>
      </div>
      <p className={`mt-1 text-xs ${muted}`}>
        {formatHours(totals.year.durationMin)} et {totals.year.elevationM.toLocaleString('fr-FR')} m
        de D+ cette année.
      </p>
      <div className="mt-3">
        <MonthlyBars
          months={monthly}
          value={(m) => (volumeMetric === 'km' ? Math.round(m.distanceKm) : m.elevationM)}
          unit={volumeMetric === 'km' ? 'km' : 'm D+'}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Évolution</h2>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          <button onClick={() => setTrendMetric('pace')} className={pill(trendMetric === 'pace')}>
            Allure
          </button>
          <button onClick={() => setTrendMetric('hr')} className={pill(trendMetric === 'hr')}>
            FC
          </button>
          <button onClick={() => setTrendMetric('cadence')} className={pill(trendMetric === 'cadence')}>
            Cadence
          </button>
        </div>
      </div>
      {trendMetric === 'pace' && (
        <p className={`mt-1 text-xs ${muted}`}>Axe inversé : plus haut = plus rapide.</p>
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

      <h2 className="mt-6 font-display text-lg font-semibold">Effort relatif</h2>
      <p className={`mt-1 text-xs ${muted}`}>
        Charge d'entraînement Strava des 16 dernières semaines.
      </p>
      <div className="mt-3">
        <EffortChart weeks={weeklyEffort} />
      </div>
    </section>
  )
}
