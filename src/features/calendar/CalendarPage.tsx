import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
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
import { GlossaryText, InfoTip, glossaryKeyFor } from '../../lib/glossary'
import {
  fetchCalendar,
  fetchPlanDetail,
  fetchPlans,
  updateSession,
  updateWeek,
  type SessionResponse,
  type SessionStatus,
  type WeekResponse,
} from './api'
import {
  DISCIPLINE_LABEL,
  KIND_DOT,
  KIND_EDGE,
  KIND_LEGEND,
  KIND_LABEL,
  WEEK_TYPE_BADGE,
  WEEK_TYPE_LABEL,
  formatDuration,
  trainingKind,
} from './labels'

type View = 'week' | 'month'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function CalendarPage() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState<SessionResponse | null>(null)
  const queryClient = useQueryClient()

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

  const sessionMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; date?: string; status?: SessionStatus }) =>
      updateSession(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setSelected(null)
    },
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
        weekSessions={view === 'week' ? (sessions.data ?? []) : []}
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
        <WeekView
          range={range}
          sessions={sessions.data ?? []}
          onSelect={setSelected}
          onMove={(id, date) => sessionMutation.mutate({ id, date })}
        />
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

      {selected && (
        <SessionModal
          session={selected}
          pending={sessionMutation.isPending}
          onStatus={(status) => sessionMutation.mutate({ id: selected.id, status })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

/* ── Header: navigation, week identity, metrics, editable focus ────── */

interface HeaderProps {
  view: View
  range: { start: Date; end: Date }
  anchor: Date
  week: WeekResponse | undefined
  weekSessions: SessionResponse[]
  onShift: (d: 1 | -1) => void
  onToday: () => void
  onView: (v: View) => void
}

function CalendarHeader({ view, range, anchor, week, weekSessions, onShift, onToday, onView }: HeaderProps) {
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

      {week && <WeekMetrics week={week} sessions={weekSessions} />}
      {week && <WeekFocus week={week} />}
    </div>
  )
}

/**
 * Week metrics as "actual / target". Actuals are computed from VALIDATED
 * sessions of the week (they'll get more precise once Strava data lands):
 * distance has no per-session actual yet, time and D+ do.
 */
function WeekMetrics({ week, sessions }: { week: WeekResponse; sessions: SessionResponse[] }) {
  const done = sessions.filter((s) => s.status === 'DONE')
  const doneElevation = done.reduce((sum, s) => sum + (s.elevationM ?? 0), 0)
  const doneMinutes = done.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
  const plannedMinutes = sessions
    .filter((s) => s.discipline !== 'REST')
    .reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
  const doneLoad = done.reduce((sum, s) => {
    const rpe = s.rpeMin != null && s.rpeMax != null ? (s.rpeMin + s.rpeMax) / 2 : (s.rpeMin ?? 0)
    return sum + rpe * (s.durationMin ?? 0)
  }, 0)

  const metrics: { label: string; actual: string | null; target: string | null }[] = [
    {
      label: 'Volume',
      actual: null, // per-session distance arrives with Strava sync
      target: week.targetVolumeKm != null ? `${week.targetVolumeKm} km` : null,
    },
    {
      label: 'D+',
      actual: doneElevation > 0 ? `${doneElevation}` : '0',
      target: week.targetElevationM != null ? `${week.targetElevationM} m` : null,
    },
    {
      label: 'Temps',
      actual: formatDuration(doneMinutes) ?? '0',
      target: formatDuration(plannedMinutes),
    },
    {
      label: 'Charge',
      actual: doneLoad > 0 ? `${Math.round(doneLoad)}` : '0',
      target: week.targetLoadUa != null ? `${week.targetLoadUa} UA` : null,
    },
  ]

  return (
    <div className="flex w-full flex-wrap gap-2">
      {metrics
        .filter((m) => m.target != null || (m.actual != null && m.actual !== '0'))
        .map((m) => (
          <span
            key={m.label}
            className="rounded-lg border border-moss-200 bg-moss-25 px-2.5 py-1 text-xs tabular-nums dark:border-moss-750 dark:bg-moss-850"
          >
            <span className="text-moss-500 dark:text-moss-400">{m.label} </span>
            <span className="font-semibold">{m.actual ?? '—'}</span>
            {m.target && <span className="text-moss-500 dark:text-moss-400"> / {m.target}</span>}
          </span>
        ))}
    </div>
  )
}

/** Collapsible + editable week description. */
function WeekFocus({ week }: { week: WeekResponse }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (focus: string) => updateWeek(week.id, { focus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      setEditing(false)
    },
  })

  if (editing) {
    return (
      <div className="w-full">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-850 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
        />
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="rounded-lg bg-pine-600 px-3 py-1 text-xs font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            Enregistrer
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  const focus = week.focus ?? ''
  const isLong = focus.length > 90

  return (
    <div className="w-full text-sm text-moss-500 dark:text-moss-400">
      {focus && (
        <span className={expanded ? 'whitespace-pre-line' : 'block truncate'}>{focus}</span>
      )}
      <span className="flex gap-3">
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-pine-700 hover:underline dark:text-pine-300"
          >
            {expanded ? 'Réduire' : 'Voir plus'}
          </button>
        )}
        <button
          onClick={() => {
            setDraft(focus)
            setEditing(true)
          }}
          className="text-xs font-medium text-moss-400 hover:text-ink hover:underline dark:text-moss-500 dark:hover:text-linen"
        >
          {focus ? 'Modifier' : 'Ajouter une description'}
        </button>
      </span>
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

/* ── Week view with drag & drop ────────────────────────────────────── */

function WeekView({
  range,
  sessions,
  onSelect,
  onMove,
}: {
  range: { start: Date; end: Date }
  sessions: SessionResponse[]
  onSelect: (s: SessionResponse) => void
  onMove: (sessionId: string, date: string) => void
}) {
  const days = eachDayOfInterval(range)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const sessionId = String(event.active.id)
    const targetDate = event.over?.id ? String(event.over.id) : null
    const session = sessions.find((s) => s.id === sessionId)
    if (!targetDate || !session || session.date === targetDate) return
    onMove(sessionId, targetDate)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mt-5 space-y-2">
        {days.map((day) => (
          <DayRow
            key={day.toISOString()}
            day={day}
            onSelect={onSelect}
            sessions={sessions.filter((s) => isSameDay(parseISO(s.date), day))}
          />
        ))}
      </div>
    </DndContext>
  )
}

function DayRow({
  day,
  sessions,
  onSelect,
}: {
  day: Date
  sessions: SessionResponse[]
  onSelect: (s: SessionResponse) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: iso(day) })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition ${
        isOver
          ? 'border-pine-600 bg-pine-100/50 dark:border-pine-350 dark:bg-pine-900/40'
          : isToday(day)
            ? 'border-pine-600 bg-moss-25 dark:border-pine-350 dark:bg-moss-850'
            : 'border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850'
      }`}
    >
      <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {format(day, 'EEEE d MMMM', { locale: fr })}
        {isToday(day) && <span className="ml-2 text-pine-700 dark:text-pine-300">aujourd'hui</span>}
      </p>
      {sessions.length === 0 ? (
        <p className="mt-1 text-sm text-moss-300 dark:text-moss-700">—</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {sessions.map((s) => (
            <DraggableSessionCard key={s.id} session={s} onClick={() => onSelect(s)} />
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_MARK: Partial<Record<SessionStatus, { label: string; cls: string }>> = {
  DONE: { label: '✓', cls: 'text-pine-700 dark:text-pine-300' },
  SKIPPED: { label: '✗', cls: 'text-clay-500 dark:text-clay-300' },
  MOVED: { label: '↻', cls: 'text-moss-400 dark:text-moss-500' },
}

function DraggableSessionCard({ session, onClick }: { session: SessionResponse; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
  })

  const meta = [
    formatDuration(session.durationMin),
    session.elevationM != null && `${session.elevationM} m D+`,
    session.rpeMin != null &&
      `RPE ${session.rpeMin}${session.rpeMax !== session.rpeMin ? `–${session.rpeMax}` : ''}`,
  ].filter(Boolean)

  const mark = STATUS_MARK[session.status]

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30, position: 'relative' }
          : undefined
      }
      className={isDragging ? 'opacity-80' : undefined}
    >
      <button
        {...listeners}
        {...attributes}
        onClick={onClick}
        className={`flex w-full touch-none items-center gap-3 rounded-lg border border-l-4 border-moss-200 bg-moss-50 px-3 py-2 text-left transition hover:border-moss-300 dark:border-moss-750 dark:bg-moss-800 dark:hover:border-moss-700 ${KIND_EDGE[trainingKind(session)]} ${
          session.status === 'DONE' || session.status === 'SKIPPED' ? 'opacity-60' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {mark && <span className={`mr-1.5 ${mark.cls}`}>{mark.label}</span>}
            <span className={session.status === 'SKIPPED' ? 'line-through' : ''}>{session.title}</span>
          </p>
          {meta.length > 0 && (
            <p className="text-xs text-moss-500 tabular-nums dark:text-moss-400">{meta.join(' · ')}</p>
          )}
        </div>
        {session.zone && (
          <span className="shrink-0 rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
            {session.zone}
          </span>
        )}
      </button>
    </div>
  )
}

/* ── Month view ────────────────────────────────────────────────────── */

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
                    className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[trainingKind(s)]}`}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-moss-500 dark:text-moss-400">
        {KIND_LEGEND.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k]}`} />
            {KIND_LABEL[k]}
          </span>
        ))}
      </p>
    </div>
  )
}

/* ── Session detail modal (the ONE place with glossary tips) ───────── */

const STATUS_LABEL: Record<SessionStatus, string> = {
  PLANNED: 'Planifiée',
  DONE: 'Validée',
  SKIPPED: 'Manquée',
  MOVED: 'Déplacée',
}

function SessionModal({
  session,
  pending,
  onStatus,
  onClose,
}: {
  session: SessionResponse
  pending: boolean
  onStatus: (status: SessionStatus) => void
  onClose: () => void
}) {
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
    ['Statut', STATUS_LABEL[session.status]],
  ].filter(([, v]) => v != null) as [string, string][]

  const isSettled = session.status === 'DONE' || session.status === 'SKIPPED'

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
            <h2 className="mt-1 font-display text-lg font-semibold text-balance">{session.title}</h2>
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
              <dt className="text-xs text-moss-500 dark:text-moss-400">
                {label === 'RPE' ? <InfoTip term="RPE">RPE</InfoTip> : label === 'D+' ? <InfoTip term="D+">D+</InfoTip> : label}
              </dt>
              <dd className="font-medium">
                {label === 'Zone' && glossaryKeyFor(value) ? (
                  <InfoTip term={glossaryKeyFor(value)!}>{value}</InfoTip>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {session.detail && (
          <p className="mt-4 border-t border-moss-200 pt-4 text-sm whitespace-pre-line text-moss-500 dark:border-moss-750 dark:text-moss-400">
            <GlossaryText text={session.detail} />
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-moss-200 pt-4 dark:border-moss-750">
          {session.status !== 'DONE' && (
            <button
              onClick={() => onStatus('DONE')}
              disabled={pending}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              ✓ Valider
            </button>
          )}
          {session.status !== 'SKIPPED' && (
            <button
              onClick={() => onStatus('SKIPPED')}
              disabled={pending}
              className="rounded-lg border border-clay-500/40 px-4 py-2 text-sm font-semibold text-clay-500 transition hover:bg-clay-100 disabled:opacity-50 dark:text-clay-300 dark:hover:bg-clay-900"
            >
              ✗ Manquée
            </button>
          )}
          {isSettled && (
            <button
              onClick={() => onStatus('PLANNED')}
              disabled={pending}
              className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
            >
              Remettre à planifiée
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
