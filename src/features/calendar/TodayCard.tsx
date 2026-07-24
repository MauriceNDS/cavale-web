import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { addDays, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { muted } from '../../lib/ui'
import { fetchActiveWorkout, startWorkout } from '../gym/api'
import { ExportMenu } from './ExportMenu'
import {
  fetchCalendar,
  fetchSessionProposal,
  type SessionResponse,
} from './api'
import {
  KIND_EDGE,
  kindLabel,
  cleanTitle,
  formatDuration,
  trainingKind,
} from './labels'

const STATUS_BADGE: Partial<Record<SessionResponse['status'], string>> = {
  DONE: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  SKIPPED: 'bg-clay-100 text-clay-500 dark:bg-clay-900 dark:text-clay-300',
}

/**
 * The daily anchor of the home page: today's session(s) — or the next
 * planned one — with the .fit export and the Strava proposal one click away.
 */
export function TodayCard() {
  const { t } = useTranslation('calendar')
  const today = format(new Date(), 'yyyy-MM-dd')
  const horizon = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const query = useQuery({
    queryKey: ['calendar', 'today', today],
    queryFn: () => fetchCalendar(today, horizon),
  })
  const activeWorkout = useQuery({
    queryKey: ['workout-active'],
    queryFn: fetchActiveWorkout,
    retry: false,
  })

  if (query.isLoading || query.isError) return null

  // Rest days aren't shown: an empty day IS the rest (same rule as the calendar).
  const sessions = (query.data ?? []).filter((s) => s.discipline !== 'REST')
  const todays = sessions.filter((s) => s.date === today)
  const nextDate = sessions.find((s) => s.date > today)?.date
  const shown = todays.length > 0 ? todays : nextDate ? sessions.filter((s) => s.date === nextDate) : []
  const showingNext = todays.length === 0 && shown.length > 0

  return (
    <section className="rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850">
      {activeWorkout.data && (
        <Link
          to="/entrainement/$workoutId"
          params={{ workoutId: activeWorkout.data.log.id }}
          className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-copper-600/40 bg-copper-600/10 px-3 py-2.5 text-sm font-semibold text-copper-600 transition hover:bg-copper-600/20 dark:border-copper-300/40 dark:bg-copper-300/10 dark:text-copper-300"
        >
          <span>
            {t('today.activeWorkout', {
              name: activeWorkout.data.log.templateName ?? t('kind.GYM'),
            })}
          </span>
          <span>{t('today.resume')}</span>
        </Link>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          {showingNext ? t('today.nextSession') : t('common:today')}
        </h2>
        <p className={`text-sm ${muted}`}>
          {format(parseISO(showingNext ? shown[0].date : today), 'EEEE d MMMM', { locale: dateLocale() })}
        </p>
      </div>
      {showingNext && <p className={`mt-1 text-sm ${muted}`}>{t('today.nothingToday')}</p>}
      {shown.length === 0 ? (
        <p className={`mt-2 text-sm ${muted}`}>
          {t('today.noneThisWeek')}{' '}
          <Link to="/planning" className="font-medium text-pine-700 underline dark:text-pine-300">
            {t('today.seeCalendar')}
          </Link>
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {shown.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </section>
  )
}

function SessionRow({ session }: { session: SessionResponse }) {
  const { t } = useTranslation('calendar')
  const navigate = useNavigate()
  const kind = trainingKind(session)
  const badgeCls = STATUS_BADGE[session.status]

  const startMutation = useMutation({
    mutationFn: () => startWorkout({ sessionId: session.id }),
    onSuccess: (detail) =>
      void navigate({ to: '/entrainement/$workoutId', params: { workoutId: detail.log.id } }),
  })

  const proposalQuery = useQuery({
    queryKey: ['session-proposal', session.id],
    queryFn: () => fetchSessionProposal(session.id),
    enabled: session.discipline === 'RUN' && session.status === 'PLANNED',
    staleTime: 60_000,
    retry: false,
  })
  const proposal = proposalQuery.data ?? null

  return (
    <div
      className={`rounded-lg border border-l-4 border-moss-200 bg-moss-50 dark:border-moss-750 dark:bg-moss-900 ${KIND_EDGE[kind]}`}
    >
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Link
          to="/session/$sessionId"
          params={{ sessionId: session.id }}
          className="min-w-0 flex-1"
        >
          <p className="truncate font-medium">{cleanTitle(session.title)}</p>
          <p className={`text-xs ${muted}`}>
            {kindLabel(kind)}
            {session.durationMin != null && ` · ${formatDuration(session.durationMin)}`}
            {session.elevationM != null && ` · ${session.elevationM} m D+`}
          </p>
        </Link>
        {badgeCls && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
            {t(`session.status.${session.status}`)}
          </span>
        )}
        {session.discipline === 'RUN' && session.status === 'PLANNED' && (
          <ExportMenu session={session} direction="down" />
        )}
        {session.discipline === 'GYM' && session.status === 'PLANNED' && session.templateVariantId && (
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="rounded-lg bg-copper-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:opacity-90 disabled:opacity-50 dark:bg-copper-300 dark:text-moss-950"
          >
            {startMutation.isPending ? t('session.starting') : t('today.start')}
          </button>
        )}
      </div>
      {proposal && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#fc4c02]/30 bg-[#fc4c02]/5 p-3 dark:bg-[#fc4c02]/10">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{t('proposal.matchingRun')}</span>{' '}
            {proposal.name ?? t('proposal.run')}
            <span className={`block text-xs ${muted}`}>
              {formatDuration(proposal.durationMin)}
              {proposal.distanceKm != null && ` · ${proposal.distanceKm} km`}
              {proposal.elevationM ? ` · ${proposal.elevationM} m D+` : ''}
            </span>
          </p>
          <Link
            to="/session/$sessionId"
            params={{ sessionId: session.id }}
            className="rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#e04502]"
          >
            {t('session.validate')}
          </Link>
        </div>
      )}
    </div>
  )
}
