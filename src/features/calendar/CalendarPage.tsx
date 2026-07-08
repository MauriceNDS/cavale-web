import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  fetchCalendar,
  fetchPlanDetail,
  fetchPlans,
  type SessionResponse,
  type WeekResponse,
} from './api'
import {
  DISCIPLINE_DOT,
  DISCIPLINE_EDGE,
  DISCIPLINE_LABEL,
  WEEK_TYPE_BADGE,
  WEEK_TYPE_LABEL,
  formatDuration,
} from './labels'

type View = 'week' | 'month'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function CalendarPage() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState<SessionResponse | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 })
      return { start, end: addDays(start, 6) }
    }
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    }
  }, [view, anchor])

  const sessions = useQuery({
    queryKey: ['calendar', iso(range.start), iso(range.end)],
    queryFn: () => fetchCalendar(iso(range.start), iso(range.end)),
  })

  const plans = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })
  const activePlan = plans.data?.find((p) => p.status === 'ACTIVE') ?? plans.data?.[0]
  const planDetail = useQuery({
    queryKey: ['plan', activePlan?.id],
    queryFn: () => fetchPlanDetail(activePlan!.id),
    enabled: !!activePlan,
  })

  const currentWeek = useMemo(() => {
    if (view !== 'week' || !planDetail.data) return undefined
    return planDetail.data.weeks.find((w) => {
      const start = parseISO(w.startDate)
      return isWithinInterval(range.start, { start, end: addDays(start, 6) })
    })
  }, [view, planDetail.data, range.start])

  function shift(direction: 1 | -1) {
    setAnchor(view === 'week' ? addWeeks(anchor, direction) : addMonths(anchor, direction))
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <CalendarHeader
        view={view}
        range={range}
        anchor={anchor}
        week={currentWeek}
        onShift={shift}
        onToday={() => setAnchor(new Date())}
        onView={setView}
      />

      {sessions.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          Impossible de charger le calendrier. Réessaie.
        </p>
      )}

      {view === 'week' ? (
        <WeekView range={range} sessions={sessions.data ?? []} onSelect={setSelected} />
      ) : (
        <MonthView
          anchor={anchor}
          range={range}
          sessions={sessions.data ?? []}
          onPickDay={(day) => {
            setAnchor(day)
            setView('week')
          }}
        />
      )}

      {selected && <SessionModal session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

/* ── Header: navigation, week identity, targets ────────────────────── */

interface HeaderProps {
  view: View
  range: { start: Date; end: Date }
  anchor: Date
  week: WeekResponse | undefined
  onShift: (d: 1 | -1) => void
  onToday: () => void
  onView: (v: View) => void
}

function CalendarHeader({ view, range, anchor, week, onShift, onToday, onView }: HeaderProps) {
  const title =
    view === 'week'
      ? `${format(range.start, 'd', { locale: fr })}–${format(range.end, 'd MMM', { locale: fr })}`
      : format(anchor, 'MMMM yyyy', { locale: fr })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <NavButton label="Période précédente" onClick={() => onShift(-1)}>
          ‹
        </NavButton>
        <button
          onClick={onToday}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
        >
          Aujourd'hui
        </button>
        <NavButton label="Période suivante" onClick={() => onShift(1)}>
          ›
        </NavButton>
      </div>

      <h1 className="font-display text-xl font-semibold capitalize">
        {week ? `S${week.weekNumber} · ${title}` : title}
      </h1>

      {week && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${WEEK_TYPE_BADGE[week.weekType]}`}
        >
          {WEEK_TYPE_LABEL[week.weekType]}
        </span>
      )}

      <div className="ml-auto flex rounded-lg border border-moss-200 p-0.5 dark:border-moss-750">
        {(['week', 'month'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              view === v
                ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
            }`}
          >
            {v === 'week' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>

      {week && (
        <div className="w-full text-sm text-moss-500 dark:text-moss-400">
          {[
            week.targetVolumeKm != null && `${week.targetVolumeKm} km`,
            week.targetElevationM != null && `${week.targetElevationM} m D+`,
            week.targetLoadUa != null && `${week.targetLoadUa} UA`,
          ]
            .filter(Boolean)
            .join(' · ')}
          {week.focus && <span className="block truncate">{week.focus}</span>}
        </div>
      )}
    </div>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
    >
      {children}
    </button>
  )
}

/* ── Week view: 7 day rows with session cards ──────────────────────── */

function WeekView({
  range,
  sessions,
  onSelect,
}: {
  range: { start: Date; end: Date }
  sessions: SessionResponse[]
  onSelect: (s: SessionResponse) => void
}) {
  const days = eachDayOfInterval(range)

  return (
    <div className="mt-5 space-y-2">
      {days.map((day) => {
        const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), day))
        return (
          <div
            key={day.toISOString()}
            className={`rounded-xl border p-3 ${
              isToday(day)
                ? 'border-pine-600 dark:border-pine-350'
                : 'border-moss-200 dark:border-moss-750'
            } bg-moss-25 dark:bg-moss-850`}
          >
            <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {format(day, 'EEEE d MMMM', { locale: fr })}
              {isToday(day) && (
                <span className="ml-2 text-pine-700 dark:text-pine-300">aujourd'hui</span>
              )}
            </p>
            {daySessions.length === 0 ? (
              <p className="mt-1 text-sm text-moss-300 dark:text-moss-700">—</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {daySessions.map((s) => (
                  <SessionCard key={s.id} session={s} onClick={() => onSelect(s)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SessionCard({ session, onClick }: { session: SessionResponse; onClick: () => void }) {
  const meta = [
    formatDuration(session.durationMin),
    session.elevationM != null && `${session.elevationM} m D+`,
    session.rpeMin != null &&
      `RPE ${session.rpeMin}${session.rpeMax !== session.rpeMin ? `–${session.rpeMax}` : ''}`,
  ].filter(Boolean)

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border border-l-4 border-moss-200 bg-moss-50 px-3 py-2 text-left transition hover:border-moss-300 dark:border-moss-750 dark:bg-moss-800 dark:hover:border-moss-700 ${DISCIPLINE_EDGE[session.discipline]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{session.title}</p>
        {meta.length > 0 && (
          <p className="text-xs text-moss-500 tabular-nums dark:text-moss-400">
            {meta.join(' · ')}
          </p>
        )}
      </div>
      {session.zone && (
        <span className="shrink-0 rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          {session.zone}
        </span>
      )}
    </button>
  )
}

/* ── Month view: compact grid with discipline dots ─────────────────── */

function MonthView({
  anchor,
  range,
  sessions,
  onPickDay,
}: {
  anchor: Date
  range: { start: Date; end: Date }
  sessions: SessionResponse[]
  onPickDay: (d: Date) => void
}) {
  const days = eachDayOfInterval(range)
  const weekdays = eachDayOfInterval({ start: range.start, end: addDays(range.start, 6) })

  return (
    <div className="mt-5">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {weekdays.map((d) => (
          <span key={d.toISOString()}>{format(d, 'EEEEE', { locale: fr })}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), day))
          const inMonth = isSameMonth(day, anchor)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onPickDay(day)}
              className={`min-h-14 rounded-lg border p-1.5 text-left transition hover:border-pine-600 dark:hover:border-pine-350 ${
                isToday(day)
                  ? 'border-pine-600 dark:border-pine-350'
                  : 'border-moss-200 dark:border-moss-750'
              } ${inMonth ? 'bg-moss-25 dark:bg-moss-850' : 'bg-transparent opacity-40'}`}
            >
              <span className="text-xs font-medium tabular-nums">{format(day, 'd')}</span>
              <span className="mt-1 flex flex-wrap gap-0.5">
                {daySessions.slice(0, 4).map((s) => (
                  <span
                    key={s.id}
                    className={`h-1.5 w-1.5 rounded-full ${DISCIPLINE_DOT[s.discipline]}`}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-moss-500 dark:text-moss-400">
        {(['RUN', 'GYM', 'CROSS', 'REST'] as const).map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${DISCIPLINE_DOT[d]}`} />
            {DISCIPLINE_LABEL[d]}
          </span>
        ))}
      </p>
    </div>
  )
}

/* ── Session detail modal ──────────────────────────────────────────── */

function SessionModal({ session, onClose }: { session: SessionResponse; onClose: () => void }) {
  const facts = [
    ['Discipline', DISCIPLINE_LABEL[session.discipline]],
    ['Zone', session.zone],
    ['Durée', formatDuration(session.durationMin)],
    ['D+', session.elevationM != null ? `${session.elevationM} m` : null],
    [
      'RPE',
      session.rpeMin != null
        ? `${session.rpeMin}${session.rpeMax !== session.rpeMin ? `–${session.rpeMax}` : ''}`
        : null,
    ],
  ].filter(([, v]) => v != null) as [string, string][]

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-moss-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={session.title}
    >
      <div
        className="w-full max-w-md rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {format(parseISO(session.date), 'EEEE d MMMM', { locale: fr })}
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-balance">
              {session.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
          >
            ✕
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-moss-500 dark:text-moss-400">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {session.detail && (
          <p className="mt-4 border-t border-moss-200 pt-4 text-sm whitespace-pre-line text-moss-500 dark:border-moss-750 dark:text-moss-400">
            {session.detail}
          </p>
        )}
      </div>
    </div>
  )
}
