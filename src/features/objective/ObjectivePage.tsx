import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale, numberLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { fetchPlans } from '../calendar/api'
import { WEEK_TYPE_BADGE, weekTypeLabel } from '../calendar/labels'
import {
  createObjective,
  deleteObjective,
  fetchProgress,
  updateObjective,
  type ObjectiveResponse,
  type PlanProgressResponse,
  type UpdateObjectivePayload,
  type WeekProgress,
} from './api'
import { ObjectiveForm } from './ObjectiveForm'
import { CumulativeChart, WeeklyChart, type Metric } from './charts'
import {
  OBJECTIVE_INTENSITY_BADGE,
  OBJECTIVE_KIND_BADGE,
  OBJECTIVE_TYPE_BADGE,
  formatHours,
  formatPaceSecPerKm,
  formatTimeMin,
  objectiveIntensityLabel,
  objectiveKindLabel,
  objectiveKmEffort,
  objectivePaceSecPerKm,
  objectiveTypeLabel,
} from './labels'

const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'
const muted = 'text-moss-500 dark:text-moss-400'

export function ObjectivePage() {
  const { t } = useTranslation('objective')
  const plans = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })
  const activePlan = plans.data?.find((p) => p.status === 'ACTIVE') ?? plans.data?.[0]

  const progress = useQuery({
    queryKey: ['progress', activePlan?.id],
    queryFn: () => fetchProgress(activePlan!.id),
    enabled: !!activePlan,
  })

  if (plans.isLoading || progress.isLoading) {
    return <p className={`mt-16 text-center ${muted}`}>{t('common:loading')}</p>
  }

  if (!activePlan) {
    return (
      <div className="mt-16 text-center">
        <h1 className="font-display text-3xl font-semibold">{t('page.title')}</h1>
        <p className={`mx-auto mt-3 max-w-md ${muted}`}>{t('page.noPlan')}</p>
      </div>
    )
  }

  if (!progress.data) {
    return <p className={`mt-16 text-center ${muted}`}>{t('page.loadError')}</p>
  }

  return <ObjectiveContent progress={progress.data} />
}

function ObjectiveContent({ progress }: { progress: PlanProgressResponse }) {
  const { t } = useTranslation('objective')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [metric, setMetric] = useState<Metric>('volume')

  const { plan, mainObjective, secondaryObjectives, weeks } = progress

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['progress', plan.id] })
    setEditing(null)
  }
  const errorOf = (error: unknown) => (error instanceof ApiError ? error.message : null)

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateObjectivePayload }) =>
      updateObjective(id, payload),
    onSuccess: invalidate,
  })
  const createMutation = useMutation({
    mutationFn: (payload: UpdateObjectivePayload) => createObjective(plan.id, payload),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({ mutationFn: deleteObjective, onSuccess: invalidate })

  // Secondary races land on the week whose 7 days contain their date
  const races = secondaryObjectives
    .filter((o) => o.date && o.type === 'RACE')
    .map((o) => ({
      name: o.name,
      weekIndex: weeks.findIndex((w) => {
        const days = differenceInCalendarDays(parseISO(o.date!), parseISO(w.startDate))
        return days >= 0 && days < 7
      }),
    }))
    .filter((r) => r.weekIndex >= 0)

  return (
    <div className="mx-auto max-w-4xl space-y-4 pt-6">
      <MainObjectiveCard
        progress={progress}
        editing={editing === mainObjective?.id}
        onEdit={() => setEditing(mainObjective?.id ?? null)}
        onCancel={() => setEditing(null)}
        onSubmit={(payload) =>
          mainObjective && updateMutation.mutate({ id: mainObjective.id, payload })
        }
        pending={updateMutation.isPending}
        error={errorOf(updateMutation.error)}
      />

      <StatTiles progress={progress} />

      {weeks.length > 0 ? (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t('weekly.title')}</h2>
            <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
              {(['volume', 'elevation'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    metric === m
                      ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
                      : `${muted} hover:text-ink dark:hover:text-linen`
                  }`}
                >
                  {m === 'volume' ? t('weekly.volumeKm') : t('weekly.elevationM')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <WeeklyChart weeks={weeks} metric={metric} races={races} />
          </div>
          <h2 className="mt-6 font-display text-lg font-semibold">{t('weekly.cumulativeTitle')}</h2>
          <div className="mt-4">
            <CumulativeChart weeks={weeks} metric={metric} />
          </div>
          <WeeksTable weeks={weeks} />
        </section>
      ) : (
        <section className={`${card} text-center`}>
          <p className={muted}>{t('weekly.emptyWeeks')}</p>
        </section>
      )}

      <SecondaryObjectives
        objectives={secondaryObjectives}
        editing={editing}
        setEditing={setEditing}
        onCreate={(payload) => createMutation.mutate(payload)}
        onUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
        onDelete={(id) => deleteMutation.mutate(id)}
        createPending={createMutation.isPending}
        updatePending={updateMutation.isPending}
        createError={errorOf(createMutation.error)}
        updateError={errorOf(updateMutation.error)}
      />
    </div>
  )
}

/* ── Main objective ────────────────────────────────────────────────── */

interface MainCardProps {
  progress: PlanProgressResponse
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSubmit: (payload: UpdateObjectivePayload) => void
  pending: boolean
  error: string | null
}

function MainObjectiveCard({ progress, editing, onEdit, onCancel, onSubmit, pending, error }: MainCardProps) {
  const { t } = useTranslation('objective')
  const { plan, mainObjective, currentWeekNumber, totalWeeks, daysToObjective, secondaryObjectives } = progress
  if (!mainObjective) return null

  const pace = objectivePaceSecPerKm(mainObjective)
  const kmEffort = objectiveKmEffort(mainObjective)
  const chips = [
    mainObjective.distanceKm != null && `${mainObjective.distanceKm} km`,
    mainObjective.elevationGainM != null &&
      `${mainObjective.elevationGainM.toLocaleString(numberLocale())} m D+`,
    // The target the runner's way: pace on the road, km-effort on the trail.
    mainObjective.kind === 'TRAIL' &&
      kmEffort != null &&
      t('main.kmEffortChip', { value: kmEffort }),
    mainObjective.kind === 'ROAD' && pace != null && t('main.paceChip', { pace: formatPaceSecPerKm(pace) }),
    mainObjective.targetTimeMin != null &&
      t('main.targetChip', { time: formatTimeMin(mainObjective.targetTimeMin) }),
    mainObjective.resultTimeMin != null &&
      t('main.doneChip', { time: formatTimeMin(mainObjective.resultTimeMin) }),
  ].filter(Boolean) as string[]

  const seasonStart = parseISO(plan.startDate)
  const seasonEnd = parseISO(plan.endDate)
  const seasonDays = Math.max(differenceInCalendarDays(seasonEnd, seasonStart), 1)
  const position = (date: string) =>
    Math.min(Math.max(differenceInCalendarDays(parseISO(date), seasonStart) / seasonDays, 0), 1)
  const objectiveDate = mainObjective.date ?? plan.endDate
  const elapsed = position(format(new Date(), 'yyyy-MM-dd'))

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-pine-700 uppercase dark:bg-pine-900 dark:text-pine-300">
              {t('main.badge')}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_TYPE_BADGE[mainObjective.type]}`}>
              {objectiveTypeLabel(mainObjective.type)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_KIND_BADGE[mainObjective.kind]}`}>
              {objectiveKindLabel(mainObjective.kind)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_INTENSITY_BADGE[mainObjective.intensity]}`}>
              {objectiveIntensityLabel(mainObjective.intensity)}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold text-balance">{mainObjective.name}</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            {format(parseISO(objectiveDate), 'EEEE d MMMM yyyy', { locale: dateLocale() })}
            {mainObjective.location && ` · ${mainObjective.location}`}
          </p>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-lg bg-moss-100 px-2.5 py-1 text-sm font-medium dark:bg-moss-800"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-right">
          <Countdown days={daysToObjective} done={mainObjective.resultTimeMin != null} />
          <button
            onClick={onEdit}
            className={`mt-2 block w-full rounded-lg px-3 py-1 text-sm font-medium ${muted} transition hover:text-ink dark:hover:text-linen`}
          >
            {t('common:edit')}
          </button>
        </div>
      </div>

      {mainObjective.notes && !editing && (
        <p className={`mt-3 border-t border-moss-200 pt-3 text-sm whitespace-pre-line dark:border-moss-750 ${muted}`}>
          {mainObjective.notes}
        </p>
      )}

      {editing && (
        <ObjectiveForm
          objective={mainObjective}
          pending={pending}
          error={error}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )}

      {/* Season timeline: elapsed share + race markers */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {currentWeekNumber != null
              ? t('main.weekOfTotal', { current: currentWeekNumber, total: totalWeeks })
              : daysToObjective > 0
                ? t('main.seasonUpcoming')
                : t('main.seasonFinished')}
          </span>
          <span className={muted}>
            {format(seasonStart, 'd MMM', { locale: dateLocale() })} →{' '}
            {format(seasonEnd, 'd MMM yyyy', { locale: dateLocale() })}
          </span>
        </div>
        <div className="relative mt-2 h-2 rounded-full bg-moss-100 dark:bg-moss-800">
          <div
            className="h-2 rounded-full bg-pine-600 dark:bg-pine-350"
            style={{ width: `${elapsed * 100}%` }}
          />
          {secondaryObjectives
            .filter((o) => o.date)
            .map((o) => (
              <span
                key={o.id}
                title={o.name}
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-moss-25 bg-copper-600 dark:border-moss-850 dark:bg-copper-300"
                style={{ left: `${position(o.date!) * 100}%` }}
              />
            ))}
          <span
            title={mainObjective.name}
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-moss-25 bg-pine-700 dark:border-moss-850 dark:bg-pine-300"
            style={{ left: `${position(objectiveDate) * 100}%` }}
          />
        </div>
      </div>
    </section>
  )
}

function Countdown({ days, done }: { days: number; done: boolean }) {
  const { t } = useTranslation('objective')
  if (done || days < 0) {
    return (
      <p className="font-display text-2xl font-semibold text-pine-700 dark:text-pine-300">
        {done ? t('main.raceDone') : t('main.over')}
      </p>
    )
  }
  return (
    <p className="font-display text-4xl font-semibold text-pine-700 dark:text-pine-300">
      {days === 0 ? t('main.today') : t('main.countdown', { count: days })}
    </p>
  )
}

/* ── Stat tiles ────────────────────────────────────────────────────── */

function StatTiles({ progress }: { progress: PlanProgressResponse }) {
  const { t } = useTranslation('objective')
  const { totals } = progress
  const adherence =
    totals.sessionsDuePast > 0
      ? Math.round((totals.sessionsDonePast / totals.sessionsDuePast) * 100)
      : null

  const tiles = [
    {
      label: t('tiles.adherence'),
      value: adherence != null ? `${adherence} %` : '—',
      detail: t('tiles.adherenceDetail', {
        done: totals.sessionsDonePast,
        due: totals.sessionsDuePast,
      }),
    },
    {
      label: t('tiles.sessions'),
      value: `${totals.sessionsDone}/${totals.sessionsPlanned}`,
      detail:
        totals.sessionsSkipped > 0
          ? t('tiles.missed', { count: totals.sessionsSkipped })
          : t('tiles.overSeason'),
    },
    {
      label: t('tiles.volume'),
      value: `${Math.round(totals.actualVolumeKm)} km`,
      detail: t('tiles.plannedVolumeToDate', { value: Math.round(totals.plannedVolumeKmToDate) }),
    },
    {
      label: t('tiles.elevation'),
      value: `${totals.actualElevationM.toLocaleString(numberLocale())} m`,
      detail: t('tiles.plannedElevationToDate', {
        value: totals.plannedElevationMToDate.toLocaleString(numberLocale()),
      }),
    },
    {
      label: t('tiles.trainingTime'),
      value: formatHours(totals.actualDurationMin),
      detail: t('tiles.validatedSessions'),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850">
          <p className={`text-xs ${muted}`}>{tile.label}</p>
          <p className="mt-1 text-xl font-semibold">{tile.value}</p>
          <p className={`mt-0.5 text-xs ${muted}`}>{tile.detail}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Weeks table (accessible fallback for the charts) ──────────────── */

function WeeksTable({ weeks }: { weeks: WeekProgress[] }) {
  const { t } = useTranslation('objective')
  return (
    <details className="mt-4">
      <summary className={`cursor-pointer text-sm ${muted} transition hover:text-ink dark:hover:text-linen`}>
        {t('table.show')}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className={`border-b border-moss-200 text-left dark:border-moss-750 ${muted}`}>
              <th className="py-1.5 pr-2 font-medium">{t('table.week')}</th>
              <th className="py-1.5 pr-2 font-medium">{t('table.type')}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{t('table.volume')}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{t('table.elevation')}</th>
              <th className="py-1.5 text-right font-medium">{t('table.sessions')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {weeks.map((week) => (
              <tr
                key={week.weekId}
                className={`border-b border-moss-200/60 dark:border-moss-750/60 ${
                  week.current ? 'bg-pine-100/50 dark:bg-pine-900/40' : ''
                }`}
              >
                <td className="py-1.5 pr-2">
                  {t('charts.weekShort', { number: week.weekNumber })}
                  <span className={`ml-2 text-xs ${muted}`}>
                    {format(parseISO(week.startDate), 'd MMM', { locale: dateLocale() })}
                  </span>
                </td>
                <td className="py-1.5 pr-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${WEEK_TYPE_BADGE[week.weekType]}`}>
                    {weekTypeLabel(week.weekType)}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {Math.round(week.actualVolumeKm * 10) / 10}
                  <span className={muted}> / {week.targetVolumeKm ?? '—'} km</span>
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {week.actualElevationM.toLocaleString(numberLocale())}
                  <span className={muted}>
                    {' '}/ {week.targetElevationM?.toLocaleString(numberLocale()) ?? '—'} m
                  </span>
                </td>
                <td className="py-1.5 text-right">
                  {week.sessionsDone}/{week.sessionsPlanned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/* ── Secondary objectives ──────────────────────────────────────────── */

interface SecondaryProps {
  objectives: ObjectiveResponse[]
  editing: string | 'new' | null
  setEditing: (value: string | 'new' | null) => void
  onCreate: (payload: UpdateObjectivePayload) => void
  onUpdate: (id: string, payload: UpdateObjectivePayload) => void
  onDelete: (id: string) => void
  createPending: boolean
  updatePending: boolean
  createError: string | null
  updateError: string | null
}

function SecondaryObjectives({
  objectives,
  editing,
  setEditing,
  onCreate,
  onUpdate,
  onDelete,
  createPending,
  updatePending,
  createError,
  updateError,
}: SecondaryProps) {
  const { t } = useTranslation('objective')
  return (
    <section className={card}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('secondary.title')}</h2>
        {editing !== 'new' && (
          <button
            onClick={() => setEditing('new')}
            className="rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {t('common:add')}
          </button>
        )}
      </div>
      <p className={`mt-1 text-sm ${muted}`}>{t('secondary.intro')}</p>

      {editing === 'new' && (
        <ObjectiveForm
          pending={createPending}
          error={createError}
          onSubmit={onCreate}
          onCancel={() => setEditing(null)}
        />
      )}

      {objectives.length === 0 && editing !== 'new' && (
        <p className={`mt-4 text-sm ${muted}`}>{t('secondary.empty')}</p>
      )}

      <ul className="mt-3 space-y-2">
        {objectives.map((objective) => (
          <li
            key={objective.id}
            className="rounded-lg border border-moss-200 bg-moss-50 p-3 dark:border-moss-750 dark:bg-moss-900"
          >
            {editing === objective.id ? (
              <ObjectiveForm
                objective={objective}
                pending={updatePending}
                error={updateError}
                onSubmit={(payload) => onUpdate(objective.id, payload)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{objective.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_TYPE_BADGE[objective.type]}`}>
                      {objectiveTypeLabel(objective.type)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OBJECTIVE_KIND_BADGE[objective.kind]}`}>
                      {objectiveKindLabel(objective.kind)}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-sm ${muted}`}>
                    {[
                      objective.date &&
                        format(parseISO(objective.date), 'EEEE d MMMM', { locale: dateLocale() }),
                      objective.distanceKm != null && `${objective.distanceKm} km`,
                      objective.elevationGainM != null && `${objective.elevationGainM} m D+`,
                      objective.kind === 'TRAIL' &&
                        objectiveKmEffort(objective) != null &&
                        t('main.kmEffortChip', { value: objectiveKmEffort(objective) }),
                      objective.kind === 'ROAD' &&
                        objectivePaceSecPerKm(objective) != null &&
                        t('main.paceChip', { pace: formatPaceSecPerKm(objectivePaceSecPerKm(objective)!) }),
                      objective.targetTimeMin != null &&
                        t('main.targetChip', { time: formatTimeMin(objective.targetTimeMin) }),
                      objective.resultTimeMin != null &&
                        t('main.doneChip', { time: formatTimeMin(objective.resultTimeMin) }),
                      objective.location,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(objective.id)}
                    className={`rounded-lg px-2.5 py-1 text-sm font-medium ${muted} transition hover:text-ink dark:hover:text-linen`}
                  >
                    {t('common:edit')}
                  </button>
                  <button
                    onClick={() => onDelete(objective.id)}
                    className="rounded-lg px-2.5 py-1 text-sm font-medium text-clay-500 transition hover:text-clay-600 dark:text-clay-300 dark:hover:text-clay-300/80"
                  >
                    {t('common:delete')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
