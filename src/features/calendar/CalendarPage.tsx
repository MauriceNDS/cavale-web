import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
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
  isValid,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../auth/session'
import { fetchTemplates } from '../gym/api'
import {
  createSession,
  fetchCalendar,
  fetchPlanDetail,
  fetchPlans,
  updateSession,
  updateWeek,
  type CreateSessionRequest,
  type SessionResponse,
  type WeekResponse,
} from './api'
import {
  KIND_DOT,
  KIND_EDGE,
  KIND_LEGEND,
  KIND_LABEL,
  WEEK_TYPE_BADGE,
  WEEK_TYPE_LABEL,
  cleanTitle,
  formatDuration,
  formatSeconds,
  totalWorkoutSeconds,
  trainingKind,
} from './labels'
import { WorkoutBuilder, draftsError, draftsToNodes, type ItemDraft } from './WorkoutBuilder'

type View = 'week' | 'month'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function CalendarPage() {
  const search = useSearch({ strict: false }) as { week?: string }
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => {
    const fromSearch = search.week ? parseISO(search.week) : null
    return fromSearch && isValid(fromSearch) ? fromSearch : new Date()
  })
  const navigate = useNavigate()
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
  // Rest days aren't shown: an empty day IS the rest
  const visibleSessions = useMemo(
    () => (sessions.data ?? []).filter((s) => s.discipline !== 'REST'),
    [sessions.data],
  )

  const plans = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })
  const activePlan = plans.data?.find((p) => p.status === 'ACTIVE') ?? plans.data?.[0]
  const planDetail = useQuery({
    queryKey: ['plan', activePlan?.id],
    queryFn: () => fetchPlanDetail(activePlan!.id),
    enabled: !!activePlan,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => updateSession(id, { date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  })

  const [adding, setAdding] = useState<Date | null>(null)
  const createMutation = useMutation({
    mutationFn: ({ weekId, body }: { weekId: string; body: CreateSessionRequest }) =>
      createSession(weekId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setAdding(null)
    },
  })

  const currentWeek = useMemo(() => {
    if (view !== 'week' || !planDetail.data) return undefined
    return planDetail.data.weeks.find((w) => {
      const start = parseISO(w.startDate)
      return isWithinInterval(range.start, { start, end: addDays(start, 6) })
    })
  }, [view, planDetail.data, range.start])

  function weekForDay(day: Date): WeekResponse | undefined {
    return planDetail.data?.weeks.find((w) => {
      const start = parseISO(w.startDate)
      return isWithinInterval(day, { start, end: addDays(start, 6) })
    })
  }

  function openSession(session: SessionResponse) {
    navigate({
      to: '/session/$sessionId',
      params: { sessionId: session.id },
      search: { from: iso(startOfWeek(anchor, { weekStartsOn: 1 })) },
    })
  }

  function shift(direction: 1 | -1) {
    setAnchor(view === 'week' ? addWeeks(anchor, direction) : addMonths(anchor, direction))
  }

  return (
    <div className={`mx-auto mt-6 ${view === 'month' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <CalendarHeader
        view={view}
        range={range}
        anchor={anchor}
        week={currentWeek}
        weekSessions={view === 'week' ? visibleSessions : []}
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
          sessions={visibleSessions}
          onSelect={openSession}
          onMove={(id, date) => moveMutation.mutate({ id, date })}
          onAdd={setAdding}
        />
      ) : (
        <MonthView
          anchor={anchor}
          range={range}
          sessions={visibleSessions}
          onPickDay={(day) => {
            setAnchor(day)
            setView('week')
          }}
        />
      )}

      {adding && (
        <AddSessionModal
          day={adding}
          week={weekForDay(adding)}
          orderInDay={visibleSessions.filter((s) => s.date === iso(adding)).length}
          pending={createMutation.isPending}
          onCreate={(weekId, body) => createMutation.mutate({ weekId, body })}
          onClose={() => setAdding(null)}
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

      <h1 className="font-display text-lg font-semibold capitalize md:text-xl">
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
 * Week metrics as "actual / target". Actuals come from validated sessions
 * (real measures when present, planned values for validated gym work).
 */
function WeekMetrics({ week, sessions }: { week: WeekResponse; sessions: SessionResponse[] }) {
  const done = sessions.filter((s) => s.status === 'DONE')
  const doneDistance = done.reduce((sum, s) => sum + (s.activity?.distanceKm ?? 0), 0)
  const doneElevation = done.reduce(
    (sum, s) => sum + (s.activity?.elevationM ?? s.elevationM ?? 0),
    0,
  )
  const doneMinutes = done.reduce(
    (sum, s) => sum + (s.activity?.durationMin ?? s.durationMin ?? 0),
    0,
  )
  const plannedMinutes = sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
  const doneLoad = done.reduce((sum, s) => {
    const rpe = s.rpeMin != null && s.rpeMax != null ? (s.rpeMin + s.rpeMax) / 2 : (s.rpeMin ?? 0)
    return sum + rpe * (s.activity?.durationMin ?? s.durationMin ?? 0)
  }, 0)

  const metrics: { label: string; actual: string | null; target: string | null }[] = [
    {
      label: 'Volume',
      actual: doneDistance > 0 ? `${Math.round(doneDistance * 10) / 10}` : '—',
      target: week.targetVolumeKm != null ? `${week.targetVolumeKm} km` : null,
    },
    {
      label: 'D+',
      actual: `${doneElevation}`,
      target: week.targetElevationM != null ? `${week.targetElevationM} m` : null,
    },
    {
      label: 'Temps',
      actual: formatDuration(doneMinutes) ?? '0',
      target: formatDuration(plannedMinutes),
    },
    {
      label: 'Charge',
      actual: `${Math.round(doneLoad)}`,
      target: week.targetLoadUa != null ? `${week.targetLoadUa} UA` : null,
    },
  ]

  return (
    // Single scrollable row on mobile — glanceable context must not stack up
    // and push the week below the fold.
    <div className="flex w-full gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible">
      {metrics
        .filter((m) => m.target != null)
        .map((m) => (
          <span
            key={m.label}
            className="shrink-0 rounded-lg border border-moss-200 bg-moss-25 px-2.5 py-1 text-xs whitespace-nowrap tabular-nums dark:border-moss-750 dark:bg-moss-850"
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
  const [isTruncated, setIsTruncated] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const el = textRef.current
    if (!el) {
      setIsTruncated(false)
      return
    }
    const measure = () => setIsTruncated(el.scrollWidth > el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [week.focus, expanded, editing])

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

  return (
    <div className="w-full text-sm text-moss-500 dark:text-moss-400">
      <div className="flex items-start gap-1.5">
        {focus && (
          <span
            ref={textRef}
            className={`min-w-0 flex-1 ${expanded ? 'whitespace-pre-line' : 'truncate'}`}
          >
            {focus}
          </span>
        )}
        <button
          onClick={() => {
            setDraft(focus)
            setEditing(true)
          }}
          title={focus ? 'Modifier la description' : 'Ajouter une description'}
          aria-label={focus ? 'Modifier la description' : 'Ajouter une description'}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-moss-400 transition hover:bg-moss-100 hover:text-ink dark:text-moss-500 dark:hover:bg-moss-800 dark:hover:text-linen"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </div>
      {(isTruncated || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-pine-700 hover:underline dark:text-pine-300"
        >
          {expanded ? 'Réduire' : 'Voir plus'}
        </button>
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

/* ── Week view with drag & drop ────────────────────────────────────── */

function WeekView({
  range,
  sessions,
  onSelect,
  onMove,
  onAdd,
}: {
  range: { start: Date; end: Date }
  sessions: SessionResponse[]
  onSelect: (s: SessionResponse) => void
  onMove: (sessionId: string, date: string) => void
  onAdd: (day: Date) => void
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
      <div className="mt-4 space-y-2 md:mt-5">
        {days.map((day) => (
          <DayRow
            key={day.toISOString()}
            day={day}
            onSelect={onSelect}
            onAdd={onAdd}
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
  onAdd,
}: {
  day: Date
  sessions: SessionResponse[]
  onSelect: (s: SessionResponse) => void
  onAdd: (day: Date) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: iso(day) })

  return (
    <div
      ref={setNodeRef}
      className={`group/day rounded-xl border p-3 transition ${
        isOver
          ? 'border-pine-600 bg-pine-100/50 dark:border-pine-350 dark:bg-pine-900/40'
          : isToday(day)
            ? 'border-pine-600 bg-moss-25 dark:border-pine-350 dark:bg-moss-850'
            : 'border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {format(day, 'EEEE d MMMM', { locale: fr })}
          {isToday(day) && <span className="ml-2 text-pine-700 dark:text-pine-300">aujourd'hui</span>}
        </p>
        <button
          onClick={() => onAdd(day)}
          aria-label={`Ajouter une séance le ${format(day, 'd MMMM', { locale: fr })}`}
          title="Ajouter une séance"
          className="-my-1 grid h-8 w-8 place-items-center rounded-md text-moss-400 transition hover:bg-moss-100 hover:text-ink focus-visible:opacity-100 md:my-0 md:h-6 md:w-6 md:opacity-0 md:group-hover/day:opacity-100 dark:text-moss-500 dark:hover:bg-moss-800 dark:hover:text-linen"
        >
          +
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="mt-1 text-sm text-moss-300 dark:text-moss-700">Repos</p>
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

const STATUS_MARK: Partial<Record<SessionResponse['status'], { label: string; cls: string }>> = {
  DONE: { label: '✓', cls: 'text-pine-700 dark:text-pine-300' },
  SKIPPED: { label: '✗', cls: 'text-clay-500 dark:text-clay-300' },
  MOVED: { label: '↻', cls: 'text-moss-400 dark:text-moss-500' },
}

function DraggableSessionCard({ session, onClick }: { session: SessionResponse; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
  })

  // total time shown ONCE: computed from the structure, else the planned duration
  const totalSec =
    session.workout.length > 0
      ? totalWorkoutSeconds(session.workout)
      : (session.durationMin ?? 0) * 60
  const meta = [
    totalSec > 0 && formatSeconds(totalSec),
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
            <span className={session.status === 'SKIPPED' ? 'line-through' : ''}>
              {cleanTitle(session.title)}
            </span>
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
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), day))
          const inMonth = isSameMonth(day, anchor)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onPickDay(day)}
              className={`min-h-16 rounded-lg border p-2 text-left align-top transition hover:border-pine-600 md:min-h-28 dark:hover:border-pine-350 ${
                isToday(day)
                  ? 'border-pine-600 dark:border-pine-350'
                  : 'border-moss-200 dark:border-moss-750'
              } ${inMonth ? 'bg-moss-25 dark:bg-moss-850' : 'bg-transparent opacity-40'}`}
            >
              <span className="text-xs font-medium tabular-nums md:text-sm">{format(day, 'd')}</span>

              <span className="mt-1 flex flex-wrap gap-1 md:hidden">
                {daySessions.slice(0, 4).map((s) => (
                  <span key={s.id} className={`h-2 w-2 rounded-full ${KIND_DOT[trainingKind(s)]}`} />
                ))}
              </span>

              <span className="mt-1.5 hidden space-y-1 md:block">
                {daySessions.slice(0, 3).map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[trainingKind(s)]}`} />
                    <span
                      className={`truncate text-[11px] leading-tight ${
                        s.status === 'DONE' || s.status === 'SKIPPED'
                          ? 'text-moss-400 dark:text-moss-500'
                          : 'text-moss-500 dark:text-moss-400'
                      }`}
                    >
                      {s.status === 'DONE' && '✓ '}
                      {cleanTitle(s.title)}
                    </span>
                  </span>
                ))}
                {daySessions.length > 3 && (
                  <span className="block text-[11px] text-moss-400 dark:text-moss-500">
                    +{daySessions.length - 3}
                  </span>
                )}
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

/* ── Manual session creation ───────────────────────────────────────── */

function AddSessionModal({
  day,
  week,
  orderInDay,
  pending,
  onCreate,
  onClose,
}: {
  day: Date
  week: WeekResponse | undefined
  orderInDay: number
  pending: boolean
  onCreate: (weekId: string, body: CreateSessionRequest) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [discipline, setDiscipline] = useState<CreateSessionRequest['discipline']>('RUN')
  const [structure, setStructure] = useState<ItemDraft[]>([])
  const [title, setTitle] = useState('')
  const [variantId, setVariantId] = useState('')
  const gymEnabled = useAuth().user?.gymEnabled ?? true

  // GYM sessions follow a strength program — picking a variant prefills the title
  const templates = useQuery({
    queryKey: ['gym-templates'],
    queryFn: fetchTemplates,
    enabled: discipline === 'GYM',
  })
  const variantOptions = (templates.data ?? [])
    .filter((t) => !t.archived)
    .flatMap((t) => t.variants.map((v) => ({ id: v.id, label: `${t.name} · ${v.label}` })))

  const inputCls =
    'mt-0.5 w-full rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!week) return
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    if (!title) {
      setError('Le titre est requis.')
      return
    }
    if (discipline === 'RUN' && structure.length > 0) {
      const problem = draftsError(structure)
      if (problem) {
        setError(problem)
        return
      }
    }
    setError(null)
    const num = (name: string) => (data.get(name) ? Number(data.get(name)) : undefined)
    onCreate(week.id, {
      date: iso(day),
      orderInDay,
      discipline,
      title,
      zone: String(data.get('zone') ?? '') || undefined,
      durationMin: num('durationMin'),
      elevationM: num('elevationM'),
      rpeMin: num('rpeMin'),
      rpeMax: num('rpeMax'),
      detail: String(data.get('detail') ?? '').trim() || undefined,
      workout: discipline === 'RUN' && structure.length > 0 ? draftsToNodes(structure) : undefined,
      templateVariantId: discipline === 'GYM' && variantId ? variantId : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-moss-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter une séance"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {format(day, 'EEEE d MMMM', { locale: fr })}
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold">Ajouter une séance</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
          >
            ✕
          </button>
        </div>

        {!week ? (
          <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">
            Ce jour est en dehors de ton plan actif — ajoute d'abord la semaine au plan.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {error && (
              <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                Discipline
                <select
                  name="discipline"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as CreateSessionRequest['discipline'])}
                  className={inputCls}
                >
                  <option value="RUN">Course</option>
                  {gymEnabled && <option value="GYM">Renfo</option>}
                  <option value="CROSS">Croisé (marche, vélo…)</option>
                </select>
              </label>
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                Zone (course)
                <select name="zone" defaultValue="" className={inputCls}>
                  <option value="">—</option>
                  {['Récup', 'EF', 'Tempo/AC', 'Seuil 60', 'Seuil 30', 'VMA', 'Sprint'].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
              {discipline === 'GYM' && (
                <label className="col-span-2 block text-xs text-moss-500 dark:text-moss-400">
                  Programme
                  <select
                    value={variantId}
                    onChange={(e) => {
                      setVariantId(e.target.value)
                      const option = variantOptions.find((o) => o.id === e.target.value)
                      if (option && !title) setTitle(option.label)
                    }}
                    className={inputCls}
                  >
                    <option value="">— séance libre —</option>
                    {variantOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="col-span-2 block text-xs text-moss-500 dark:text-moss-400">
                Titre *
                <input
                  name="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EF · Renfo FM-A · …"
                  className={inputCls}
                />
              </label>
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                Durée (min)
                <input name="durationMin" type="number" min="1" className={inputCls} />
              </label>
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                D+ (m)
                <input name="elevationM" type="number" min="0" className={inputCls} />
              </label>
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                RPE min
                <input name="rpeMin" type="number" min="0" max="10" className={inputCls} />
              </label>
              <label className="block text-xs text-moss-500 dark:text-moss-400">
                RPE max
                <input name="rpeMax" type="number" min="0" max="10" className={inputCls} />
              </label>
              <label className="col-span-2 block text-xs text-moss-500 dark:text-moss-400">
                Consignes (texte libre)
                <textarea name="detail" rows={2} className={inputCls} />
              </label>
            </div>

            {discipline === 'RUN' && (
              <div>
                <p className="text-xs font-semibold text-moss-500 dark:text-moss-400">
                  Structure de la séance
                </p>
                <div className="mt-1.5">
                  <WorkoutBuilder items={structure} onChange={setStructure} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
              >
                {pending ? 'Création…' : 'Ajouter la séance'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
