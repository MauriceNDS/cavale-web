import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  downloadSessionFit,
  fetchCalendar,
  fetchSessionProposal,
  type SessionResponse,
} from './api'
import {
  KIND_EDGE,
  KIND_LABEL,
  cleanTitle,
  formatDuration,
  trainingKind,
} from './labels'

const muted = 'text-moss-500 dark:text-moss-400'

const STATUS_BADGE: Partial<Record<SessionResponse['status'], { label: string; className: string }>> = {
  DONE: { label: 'Validée', className: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300' },
  SKIPPED: { label: 'Passée', className: 'bg-clay-100 text-clay-500 dark:bg-clay-900 dark:text-clay-300' },
}

/**
 * The daily anchor of the home page: today's session(s) — or the next
 * planned one — with the .fit export and the Strava proposal one click away.
 */
export function TodayCard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const horizon = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const query = useQuery({
    queryKey: ['calendar', 'today', today],
    queryFn: () => fetchCalendar(today, horizon),
  })

  if (query.isLoading || query.isError) return null

  const sessions = query.data ?? []
  const todays = sessions.filter((s) => s.date === today)
  const nextDate = sessions.find((s) => s.date > today)?.date
  const shown = todays.length > 0 ? todays : nextDate ? sessions.filter((s) => s.date === nextDate) : []
  const showingNext = todays.length === 0 && shown.length > 0

  return (
    <section className="rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          {showingNext ? 'Prochaine séance' : 'Aujourd’hui'}
        </h2>
        <p className={`text-sm ${muted}`}>
          {format(parseISO(showingNext ? shown[0].date : today), 'EEEE d MMMM', { locale: fr })}
        </p>
      </div>
      {showingNext && <p className={`mt-1 text-sm ${muted}`}>Rien de prévu aujourd'hui.</p>}
      {shown.length === 0 ? (
        <p className={`mt-2 text-sm ${muted}`}>
          Aucune séance planifiée cette semaine —{' '}
          <Link to="/calendrier" className="font-medium text-pine-700 underline dark:text-pine-300">
            voir le calendrier
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
  const [exporting, setExporting] = useState(false)
  const kind = trainingKind(session)
  const badge = STATUS_BADGE[session.status]
  const isRest = session.discipline === 'REST'

  const proposalQuery = useQuery({
    queryKey: ['session-proposal', session.id],
    queryFn: () => fetchSessionProposal(session.id),
    enabled: session.discipline === 'RUN' && session.status === 'PLANNED',
    staleTime: 60_000,
    retry: false,
  })
  const proposal = proposalQuery.data ?? null

  async function handleExport() {
    setExporting(true)
    try {
      await downloadSessionFit(session)
    } finally {
      setExporting(false)
    }
  }

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
          <p className={`truncate font-medium ${isRest ? muted : ''}`}>{cleanTitle(session.title)}</p>
          <p className={`text-xs ${muted}`}>
            {KIND_LABEL[kind]}
            {session.durationMin != null && ` · ${formatDuration(session.durationMin)}`}
            {session.elevationM != null && ` · ${session.elevationM} m D+`}
          </p>
        </Link>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
        {session.discipline === 'RUN' && session.status === 'PLANNED' && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg border border-moss-200 px-3 py-1.5 text-sm font-medium transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:hover:bg-moss-800"
          >
            {exporting ? 'Export…' : '⌚ .fit'}
          </button>
        )}
      </div>
      {proposal && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#fc4c02]/30 bg-[#fc4c02]/5 p-3 dark:bg-[#fc4c02]/10">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Sortie Strava correspondante :</span>{' '}
            {proposal.name ?? 'Sortie'}
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
            ✓ Valider
          </Link>
        </div>
      )}
    </div>
  )
}
