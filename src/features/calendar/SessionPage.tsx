import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ApiError } from '../../lib/api'
import { GlossaryText } from '../../lib/glossary'
import { useMeasuredWidth } from '../../lib/useMeasuredWidth'
import { startWorkout } from '../gym/api'
import { fetchStravaActivities } from '../strava/api'
import {
  downloadSessionFit,
  fetchSession,
  fetchSessionProposal,
  fetchSessionStreams,
  updateSession,
  validateSession,
  validateSessionFromStrava,
  type ActivityStreams,
  type PerceivedEffort,
  type SessionProposal,
  type SessionResponse,
  type ValidateSessionRequest,
  type WorkoutNode,
} from './api'
import {
  DISCIPLINE_LABEL,
  EFFORTS,
  EFFORT_LABEL,
  cleanTitle,
  formatDuration,
  formatSeconds,
  totalWorkoutSeconds,
} from './labels'
import { WorkoutTree } from './WorkoutView'
import {
  WorkoutBuilder,
  draftsError,
  draftsToNodes,
  nodesToDrafts,
  type ItemDraft,
} from './WorkoutBuilder'

const STATUS_LABEL: Record<SessionResponse['status'], string> = {
  PLANNED: 'Planifiée',
  DONE: 'Validée',
  SKIPPED: 'Passée',
  MOVED: 'Déplacée',
}

function formatPace(durationMin: number, distanceKm: number | null): string | null {
  if (!distanceKm || distanceKm <= 0) return null
  const secPerKm = Math.round((durationMin * 60) / distanceKm)
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`
}

/* ── Page ──────────────────────────────────────────────────────────── */

export function SessionPage() {
  const params = useParams({ strict: false }) as { sessionId?: string }
  const search = useSearch({ strict: false }) as { from?: string }
  const sessionId = params.sessionId!
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    queryClient.invalidateQueries({ queryKey: ['session-proposal', sessionId] })
    queryClient.invalidateQueries({ queryKey: ['calendar'] })
  }

  const statusMutation = useMutation({
    mutationFn: (body: { status?: SessionResponse['status']; workout?: WorkoutNode[]; date?: string }) =>
      updateSession(sessionId, body),
    onSuccess: invalidate,
  })

  const session = query.data

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <Link
        to="/calendrier"
        search={search.from ? { week: search.from } : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
      >
        ← Retour à la semaine
      </Link>

      {query.isLoading && (
        <p className="mt-10 text-center text-moss-500 dark:text-moss-400">Chargement…</p>
      )}
      {query.isError && (
        <p className="mt-10 text-center text-clay-500 dark:text-clay-300">
          Séance introuvable.
        </p>
      )}

      {session && (
        <SessionView session={session} statusMutation={statusMutation} onDone={invalidate} />
      )}
      {statusMutation.isError && (
        <p role="alert" className="mt-3 text-sm text-clay-500 dark:text-clay-300">
          L'action a échoué. Réessaie.
        </p>
      )}
      {void navigate}
    </div>
  )
}

function SessionView({
  session,
  statusMutation,
  onDone,
}: {
  session: SessionResponse
  statusMutation: { mutate: (b: { status?: SessionResponse['status']; workout?: WorkoutNode[]; date?: string }) => void; isPending: boolean }
  onDone: () => void
}) {
  const [editingStructure, setEditingStructure] = useState(false)
  const [exporting, setExporting] = useState(false)

  const totalSec =
    session.workout.length > 0
      ? totalWorkoutSeconds(session.workout)
      : (session.durationMin ?? 0) * 60
  const isValidated = session.status === 'DONE' && session.activity != null
  const consignes = session.structureNotes ?? session.detail

  async function handleExport() {
    setExporting(true)
    try {
      await downloadSessionFit(session)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mt-4">
      {/* ── Header ── */}
      <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {format(parseISO(session.date), 'EEEE d MMMM', { locale: fr })} ·{' '}
        {DISCIPLINE_LABEL[session.discipline]}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-balance">
          {cleanTitle(session.title)}
        </h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            session.status === 'DONE'
              ? 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300'
              : session.status === 'SKIPPED'
                ? 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300'
                : 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400'
          }`}
        >
          {STATUS_LABEL[session.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {totalSec > 0 && <HeaderChip label="Durée" value={formatSeconds(totalSec)!} />}
        {session.elevationM != null && <HeaderChip label="D+" value={`${session.elevationM} m`} />}
        {session.rpeMin != null && (
          <HeaderChip
            label="RPE"
            value={`${session.rpeMin}${session.rpeMax !== session.rpeMin ? `–${session.rpeMax}` : ''}`}
          />
        )}
        {session.zone && <HeaderChip label="Zone" value={session.zone} />}
        {session.templateName && (
          <span className="rounded-lg border border-copper-600/40 bg-copper-600/10 px-2.5 py-1 text-xs font-semibold text-copper-600 dark:border-copper-300/40 dark:bg-copper-300/10 dark:text-copper-300">
            {session.templateName} · {session.variantLabel}
          </span>
        )}
      </div>

      {isValidated ? (
        <ActivityReport session={session} statusMutation={statusMutation} />
      ) : (
        <>
          {/* ── Consignes ── */}
          {consignes && (
            <div className="mt-5 rounded-lg bg-moss-100 p-3 text-sm dark:bg-moss-800">
              <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
                Consignes
              </p>
              <p className="mt-1 whitespace-pre-line text-moss-500 dark:text-moss-400">
                <GlossaryText text={consignes} />
              </p>
            </div>
          )}

          {/* ── Blocs ── */}
          {editingStructure ? (
            <StructureEditor
              session={session}
              pending={statusMutation.isPending}
              onSave={(workout) => {
                statusMutation.mutate({ workout })
                setEditingStructure(false)
              }}
              onCancel={() => setEditingStructure(false)}
            />
          ) : (
            session.discipline === 'RUN' && (
              <div className="mt-5">
                {session.workout.length > 0 ? (
                  <WorkoutTree nodes={session.workout} />
                ) : (
                  <p className="text-sm text-moss-400 dark:text-moss-500">
                    Pas encore de structure.
                  </p>
                )}
                <button
                  onClick={() => setEditingStructure(true)}
                  className="mt-1.5 text-xs font-medium text-moss-400 hover:text-ink hover:underline dark:text-moss-500 dark:hover:text-linen"
                >
                  {session.workout.length > 0 ? 'Modifier la structure' : '+ Créer la structure'}
                </button>
              </div>
            )
          )}

          {/* ── Actions ── */}
          {!editingStructure && (
            <SessionActions
              session={session}
              exporting={exporting}
              onExport={handleExport}
              statusMutation={statusMutation}
              onValidated={onDone}
            />
          )}
        </>
      )}
    </div>
  )
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-moss-200 bg-moss-25 px-2.5 py-1 text-xs tabular-nums dark:border-moss-750 dark:bg-moss-850">
      <span className="text-moss-500 dark:text-moss-400">{label} </span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

/* ── Validation wizard: choose → details → effort ──────────────────── */

type WizardStep =
  | { kind: 'none' }
  | { kind: 'choose' }
  | { kind: 'strava' }
  | { kind: 'manual' }
  | { kind: 'move' }
  | { kind: 'effort'; payload: { strava?: number; manual?: Omit<ValidateSessionRequest, 'perceivedEffort' | 'comment'> } }

function SessionActions({
  session,
  exporting,
  onExport,
  statusMutation,
  onValidated,
}: {
  session: SessionResponse
  exporting: boolean
  onExport: () => void
  statusMutation: { mutate: (b: { status?: SessionResponse['status']; date?: string }) => void; isPending: boolean }
  onValidated: () => void
}) {
  const [step, setStep] = useState<WizardStep>({ kind: 'none' })
  const [proposalDismissed, setProposalDismissed] = useState(false)

  const proposalQuery = useQuery({
    queryKey: ['session-proposal', session.id],
    queryFn: () => fetchSessionProposal(session.id),
    enabled: session.discipline === 'RUN' && session.status === 'PLANNED',
    staleTime: 60_000,
    retry: false,
  })

  const validateMutation = useMutation({
    mutationFn: (body: ValidateSessionRequest) => validateSession(session.id, body),
    onSuccess: onValidated,
  })
  const stravaMutation = useMutation({
    mutationFn: (body: {
      stravaActivityId: number
      perceivedEffort: PerceivedEffort
      painFlag?: boolean
      comment?: string
    }) => validateSessionFromStrava(session.id, body),
    onSuccess: onValidated,
  })

  const pending = statusMutation.isPending || validateMutation.isPending || stravaMutation.isPending

  if (session.discipline === 'REST') return null

  if (step.kind === 'choose') {
    return (
      <WizardShell title="Comment valider ?" onCancel={() => setStep({ kind: 'none' })}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStep({ kind: 'strava' })}
            className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502]"
          >
            Importer depuis Strava
          </button>
          <button
            onClick={() => setStep({ kind: 'manual' })}
            className="rounded-lg border border-pine-600/50 px-4 py-2 text-sm font-semibold text-pine-700 transition hover:bg-pine-100 dark:text-pine-300 dark:hover:bg-pine-900"
          >
            Saisir manuellement
          </button>
        </div>
      </WizardShell>
    )
  }

  if (step.kind === 'strava') {
    return (
      <WizardShell title="Sorties Strava récentes" onCancel={() => setStep({ kind: 'none' })}>
        <StravaPicker onPick={(id) => setStep({ kind: 'effort', payload: { strava: id } })} />
      </WizardShell>
    )
  }

  if (step.kind === 'manual') {
    return (
      <WizardShell title="Mesures de la sortie" onCancel={() => setStep({ kind: 'none' })}>
        <ManualForm
          session={session}
          onSubmit={(measures) => setStep({ kind: 'effort', payload: { manual: measures } })}
        />
      </WizardShell>
    )
  }

  if (step.kind === 'move') {
    return (
      <WizardShell title="Déplacer la séance" onCancel={() => setStep({ kind: 'none' })}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const date = new FormData(event.currentTarget).get('date') as string
            if (date && date !== session.date) statusMutation.mutate({ date })
            setStep({ kind: 'none' })
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="block text-xs text-moss-500 dark:text-moss-400">
            Nouvelle date
            <input
              name="date"
              type="date"
              required
              defaultValue={session.date}
              className="mt-0.5 block rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:text-linen dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            Déplacer
          </button>
        </form>
      </WizardShell>
    )
  }

  if (step.kind === 'effort') {
    return (
      <WizardShell title="Comment c'était ?" onCancel={() => setStep({ kind: 'none' })}>
        <EffortForm
          pending={pending}
          error={validateMutation.isError || stravaMutation.isError}
          onSubmit={(perceivedEffort, painFlag, comment) => {
            if (step.payload.strava != null) {
              stravaMutation.mutate({
                stravaActivityId: step.payload.strava,
                perceivedEffort,
                painFlag,
                comment,
              })
            } else if (step.payload.manual) {
              validateMutation.mutate({ ...step.payload.manual, perceivedEffort, painFlag, comment })
            }
          }}
        />
      </WizardShell>
    )
  }

  const proposal = !proposalDismissed ? (proposalQuery.data ?? null) : null

  return (
    <>
      {proposal && (
        <div className="mt-6">
          <ProposalBanner
            proposal={proposal}
            onValidate={() =>
              setStep({ kind: 'effort', payload: { strava: proposal.stravaActivityId } })
            }
            onDismiss={() => setProposalDismissed(true)}
          />
        </div>
      )}
      {/* Sticky on mobile: mid-workout, « Valider » stays one thumb away. */}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 border-t border-moss-200 bg-moss-50/95 px-4 py-3 backdrop-blur md:static md:z-auto md:mx-0 md:bg-transparent md:px-0 md:pt-4 md:pb-0 md:backdrop-blur-none dark:border-moss-750 dark:bg-moss-900/95 dark:md:bg-transparent">
      <div className="flex flex-wrap gap-2">
      {session.discipline === 'RUN' && (
        <button
          onClick={onExport}
          disabled={exporting}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-ink transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-linen dark:hover:bg-moss-800"
        >
          {exporting ? 'Export…' : '⌚ Exporter .fit'}
        </button>
      )}
      {session.discipline === 'GYM' && session.status === 'PLANNED' && session.templateVariantId && (
        <StartWorkoutButton sessionId={session.id} />
      )}
      {session.status !== 'DONE' && session.status !== 'SKIPPED' && (
        <>
          <button
            onClick={() =>
              session.discipline === 'RUN'
                ? setStep({ kind: 'choose' })
                : statusMutation.mutate({ status: 'DONE' })
            }
            disabled={pending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            ✓ Valider
          </button>
          <button
            onClick={() => statusMutation.mutate({ status: 'SKIPPED' })}
            disabled={pending}
            className="rounded-lg border border-clay-500/40 px-4 py-2 text-sm font-semibold text-clay-500 transition hover:bg-clay-100 disabled:opacity-50 dark:text-clay-300 dark:hover:bg-clay-900"
          >
            Passer
          </button>
          <button
            onClick={() => setStep({ kind: 'move' })}
            disabled={pending}
            className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
          >
            Déplacer
          </button>
        </>
      )}
      {session.status === 'SKIPPED' && (
        <button
          onClick={() => statusMutation.mutate({ status: 'PLANNED' })}
          disabled={pending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          Annuler « passée »
        </button>
      )}
      {session.status === 'DONE' && (
        <button
          onClick={() => statusMutation.mutate({ status: 'PLANNED' })}
          disabled={pending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          Remettre à planifiée
        </button>
      )}
      </div>
      </div>
    </>
  )
}

/** GYM: one tap opens the live workout — finishing it validates the session. */
function StartWorkoutButton({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () => startWorkout({ sessionId }),
    onSuccess: (detail) =>
      void navigate({ to: '/entrainement/$workoutId', params: { workoutId: detail.log.id } }),
  })

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="rounded-lg bg-copper-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:opacity-90 disabled:opacity-50 dark:bg-copper-300 dark:text-moss-950"
    >
      {mutation.isPending ? 'Démarrage…' : '🏋 Démarrer la séance'}
    </button>
  )
}

/** "That run looks like this session" — one click from ingestion to validation. */
function ProposalBanner({
  proposal,
  onValidate,
  onDismiss,
}: {
  proposal: SessionProposal
  onValidate: () => void
  onDismiss: () => void
}) {
  const pace = formatPace(proposal.durationMin, proposal.distanceKm)
  const facts = [
    format(parseISO(proposal.date), 'EEEE d MMMM', { locale: fr }),
    formatDuration(proposal.durationMin),
    proposal.distanceKm != null ? `${proposal.distanceKm} km` : null,
    pace,
    proposal.elevationM ? `${proposal.elevationM} m D+` : null,
  ].filter(Boolean)

  return (
    <div className="mb-4 rounded-xl border border-[#fc4c02]/30 bg-[#fc4c02]/5 p-3 dark:bg-[#fc4c02]/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">Cette sortie Strava semble correspondre :</span>{' '}
          {proposal.name ?? 'Sortie'}
          <span className="mt-0.5 block text-xs text-moss-500 dark:text-moss-400">
            {facts.join(' · ')}
          </span>
        </p>
        <button
          onClick={onDismiss}
          aria-label="Ignorer la proposition"
          className="rounded p-1 text-xs text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          ✕
        </button>
      </div>
      <button
        onClick={onValidate}
        className="mt-2 rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502]"
      >
        ✓ Valider cette sortie
      </button>
    </div>
  )
}

function WizardShell({
  title,
  onCancel,
  children,
}: {
  title: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mt-6 border-t border-moss-200 pt-4 dark:border-moss-750">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button
          onClick={onCancel}
          className="text-xs font-medium text-moss-500 hover:underline dark:text-moss-400"
        >
          Annuler
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function StravaPicker({ onPick }: { onPick: (id: number) => void }) {
  const activities = useQuery({
    queryKey: ['strava-activities'],
    queryFn: fetchStravaActivities,
    staleTime: 60_000,
    retry: false,
  })
  const notConnected = activities.error instanceof ApiError && activities.error.status === 409

  if (activities.isLoading)
    return <p className="text-sm text-moss-500 dark:text-moss-400">Chargement des sorties…</p>
  if (notConnected)
    return (
      <p className="text-sm text-moss-500 dark:text-moss-400">
        Strava n'est pas connecté.{' '}
        <Link to="/settings" className="font-medium text-pine-700 underline dark:text-pine-300">
          Connecter dans les réglages
        </Link>
      </p>
    )
  if (activities.isError)
    return (
      <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
        Impossible de charger les sorties Strava. Réessaie.
      </p>
    )
  if (!activities.data || activities.data.length === 0)
    return (
      <p className="text-sm text-moss-500 dark:text-moss-400">
        Aucune sortie récente à importer — tout est déjà rattaché.
      </p>
    )

  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {activities.data.map((a) => (
        <button
          key={a.id}
          onClick={() => onPick(a.id)}
          className="w-full rounded-lg border border-moss-200 bg-moss-50 px-3 py-2 text-left transition hover:border-[#fc4c02] dark:border-moss-750 dark:bg-moss-800 dark:hover:border-[#fc4c02]"
        >
          <p className="truncate text-sm font-medium">{a.name}</p>
          <p className="text-xs text-moss-500 tabular-nums dark:text-moss-400">
            {format(parseISO(a.date), 'EEE d MMM', { locale: fr })} ·{' '}
            {[
              `${a.distanceKm} km`,
              formatDuration(a.durationMin),
              formatPace(a.durationMin, a.distanceKm),
              a.elevationM != null && a.elevationM > 0 && `${a.elevationM} m D+`,
              a.avgHr != null && `${a.avgHr} bpm`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </button>
      ))}
    </div>
  )
}

function ManualForm({
  session,
  onSubmit,
}: {
  session: SessionResponse
  onSubmit: (measures: Omit<ValidateSessionRequest, 'perceivedEffort' | 'comment'>) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const inputCls =
    'mt-0.5 w-full rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const durationMin = Number(data.get('durationMin'))
    const distanceKm = Number(data.get('distanceKm'))
    if (!durationMin || durationMin <= 0 || !distanceKm || distanceKm <= 0) {
      setError('La durée et la distance sont obligatoires.')
      return
    }
    setError(null)
    onSubmit({
      durationMin,
      distanceKm,
      elevationM: data.get('elevationM') ? Number(data.get('elevationM')) : undefined,
      avgHr: data.get('avgHr') ? Number(data.get('avgHr')) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <p role="alert" className="mb-2 text-sm text-clay-500 dark:text-clay-300">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          Durée (min) *
          <input name="durationMin" type="number" min="1" required
            defaultValue={session.durationMin ?? ''} className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          Distance (km) *
          <input name="distanceKm" type="number" min="0.1" step="0.01" required className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          D+ (m)
          <input name="elevationM" type="number" min="0" className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          FC moyenne (bpm)
          <input name="avgHr" type="number" min="30" max="250" className={inputCls} />
        </label>
      </div>
      <button
        type="submit"
        className="mt-3 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        Continuer
      </button>
    </form>
  )
}

function EffortForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean
  error: boolean
  onSubmit: (effort: PerceivedEffort, painFlag: boolean, comment?: string) => void
}) {
  const [effort, setEffort] = useState<PerceivedEffort>('COMME_PREVU')
  const [pain, setPain] = useState(false)
  const [comment, setComment] = useState('')

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-clay-500 dark:text-clay-300">
          La validation a échoué. Réessaie.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Effort perçu">
        {EFFORTS.map((e) => (
          <button
            key={e}
            role="radio"
            aria-checked={effort === e}
            onClick={() => setEffort(e)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              effort === e
                ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
            }`}
          >
            {EFFORT_LABEL[e]}
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pain}
          onChange={(e) => setPain(e.target.checked)}
          className="h-4 w-4 accent-clay-500"
        />
        <span className={pain ? 'font-medium text-clay-500 dark:text-clay-300' : ''}>
          Douleur ou gêne ressentie pendant la sortie
        </span>
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Un mot sur la séance ? (optionnel)"
        className="mt-3 w-full rounded-lg border border-moss-200 bg-moss-100 p-2.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
      />
      <button
        onClick={() => onSubmit(effort, pain, comment.trim() || undefined)}
        disabled={pending}
        className="mt-2 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {pending ? 'Validation…' : '✓ Valider la séance'}
      </button>
    </div>
  )
}

/* ── Structure editor (reused from the builder) ────────────────────── */

function StructureEditor({
  session,
  pending,
  onSave,
  onCancel,
}: {
  session: SessionResponse
  pending: boolean
  onSave: (workout: WorkoutNode[]) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<ItemDraft[]>(() => nodesToDrafts(session.workout))
  const [error, setError] = useState<string | null>(null)

  function save() {
    const problem = draftsError(items)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    onSave(draftsToNodes(items))
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Structure de la séance</p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-clay-500 dark:text-clay-300">
          {error}
        </p>
      )}
      <div className="mt-2">
        <WorkoutBuilder items={items} onChange={setItems} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          Enregistrer la structure
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

/* ── Report: the validated session ─────────────────────────────────── */

function ActivityReport({
  session,
  statusMutation,
}: {
  session: SessionResponse
  statusMutation: { mutate: (b: { status?: SessionResponse['status'] }) => void; isPending: boolean }
}) {
  const activity = session.activity!
  const streams = useQuery({
    queryKey: ['session-streams', session.id],
    queryFn: () => fetchSessionStreams(session.id),
    enabled: activity.hasStreams,
    staleTime: Infinity,
    retry: false,
  })

  const tiles: { label: string; value: string }[] = [
    activity.distanceKm != null && { label: 'Distance', value: `${activity.distanceKm} km` },
    { label: 'Temps', value: formatDuration(activity.durationMin) ?? '—' },
    activity.distanceKm != null && {
      label: 'Allure moy.',
      value: formatPace(activity.durationMin, activity.distanceKm) ?? '—',
    },
    activity.elevationM != null && { label: 'D+', value: `${activity.elevationM} m` },
    activity.avgHr != null && { label: 'FC moy.', value: `${activity.avgHr} bpm` },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="mt-5">
      {activity.name && (
        <p className="text-sm text-moss-500 dark:text-moss-400">
          {activity.source === 'STRAVA' ? 'Strava · ' : ''}
          {activity.name}
        </p>
      )}

      {/* stat tiles */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850"
          >
            <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
              {tile.label}
            </p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>

      {/* effort + comment */}
      <div className="mt-3 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
        <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          Ressenti
        </p>
        <p className="mt-0.5 text-sm font-medium">
          {activity.perceivedEffort ? EFFORT_LABEL[activity.perceivedEffort] : '—'}
          {activity.painFlag && (
            <span className="ml-2 rounded-full bg-clay-100 px-2 py-0.5 text-xs font-semibold text-clay-600 dark:bg-clay-900 dark:text-clay-300">
              ⚠ Douleur signalée
            </span>
          )}
        </p>
        {activity.comment && (
          <p className="mt-1 text-sm whitespace-pre-line text-moss-500 dark:text-moss-400">
            {activity.comment}
          </p>
        )}
      </div>

      {/* charts */}
      {activity.hasStreams && streams.data && <StreamCharts streams={streams.data} />}
      {activity.hasStreams && streams.isLoading && (
        <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">Chargement des courbes…</p>
      )}

      <div className="mt-6 flex gap-2 border-t border-moss-200 pt-4 dark:border-moss-750">
        <button
          onClick={() => statusMutation.mutate({ status: 'PLANNED' })}
          disabled={statusMutation.isPending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          Remettre à planifiée
        </button>
      </div>
    </div>
  )
}

/* ── Charts — one series each, hover crosshair, Massif tokens ──────── */

function StreamCharts({ streams }: { streams: ActivityStreams }) {
  const km = streams.distance.map((d) => d / 1000)

  const altitude = useMemo(
    () => km.map((x, i) => ({ x, y: streams.alt[i] })).filter((p) => p.y != null),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pace = useMemo(
    () =>
      km
        .map((x, i) => ({ x, y: streams.vel[i] }))
        .filter((p) => p.y != null && p.y > 0.5)
        .map((p) => ({ x: p.x, y: 1000 / p.y / 60 })), // min per km
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const hr = useMemo(
    () => km.map((x, i) => ({ x, y: streams.hr[i] })).filter((p) => p.y != null && p.y > 0),
    [streams], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fmtPace = (y: number) => {
    const sec = Math.round(y * 60)
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`
  }

  return (
    <div className="mt-4 space-y-3">
      {altitude.length > 1 && (
        <StreamChart
          title="Profil (m)"
          points={altitude}
          colorClass="text-pine-600 dark:text-pine-350"
          area
          yFormat={(y) => `${Math.round(y)} m`}
        />
      )}
      {pace.length > 1 && (
        <StreamChart
          title="Allure (min/km)"
          points={pace}
          colorClass="text-teal-600 dark:text-teal-300"
          invertY
          yFormat={fmtPace}
        />
      )}
      {hr.length > 1 && (
        <StreamChart
          title="Fréquence cardiaque (bpm)"
          points={hr}
          colorClass="text-rowan-600 dark:text-rowan-300"
          yFormat={(y) => `${Math.round(y)} bpm`}
        />
      )}
    </div>
  )
}

const FALLBACK_W = 600
const H = 150
const PAD = { left: 8, right: 8, top: 10, bottom: 18 }

function StreamChart({
  title,
  points,
  colorClass,
  yFormat,
  area = false,
  invertY = false,
}: {
  title: string
  points: { x: number; y: number }[]
  colorClass: string
  yFormat: (y: number) => string
  area?: boolean
  invertY?: boolean
}) {
  const { ref, width: W } = useMeasuredWidth<HTMLDivElement>(FALLBACK_W)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const xMin = points[0].x
  const xMax = points[points.length - 1].x
  const ys = points.map((p) => p.y)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  const padY = (yMax - yMin || 1) * 0.08
  yMin -= padY
  yMax += padY

  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => {
    const t = (y - yMin) / (yMax - yMin || 1)
    const tt = invertY ? t : 1 - t
    return PAD.top + tt * (H - PAD.top - PAD.bottom)
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const baseline = invertY ? PAD.top : H - PAD.bottom
  const areaPath = `${line}L${sx(xMax).toFixed(1)},${baseline}L${sx(xMin).toFixed(1)},${baseline}Z`

  // Pointer events cover mouse AND touch: a finger drag scrubs the crosshair.
  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHover(best)
  }

  const hovered = hover != null ? points[hover] : null

  return (
    <figure className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {title}
        </span>
        <span className="text-xs font-medium tabular-nums">
          {hovered ? `${hovered.x.toFixed(1)} km · ${yFormat(hovered.y)}` : ' '}
        </span>
      </figcaption>
      <div ref={ref} className={colorClass}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 w-full touch-pan-y"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={title}
        >
          {/* recessive grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + t * (H - PAD.top - PAD.bottom)}
              y2={PAD.top + t * (H - PAD.top - PAD.bottom)}
              className="stroke-moss-200 dark:stroke-moss-750"
              strokeWidth="1"
            />
          ))}
          {area && <path d={areaPath} fill="currentColor" opacity="0.15" stroke="none" />}
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          {hovered && (
            <>
              <line
                x1={sx(hovered.x)}
                x2={sx(hovered.x)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-moss-400 dark:stroke-moss-500"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={sx(hovered.x)} cy={sy(hovered.y)} r="4" fill="currentColor" />
            </>
          )}
          {/* x labels */}
          <text x={PAD.left} y={H - 4} className="fill-moss-400 dark:fill-moss-500" fontSize="10">
            {xMin.toFixed(0)} km
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-moss-400 dark:fill-moss-500" fontSize="10">
            {xMax.toFixed(1)} km
          </text>
        </svg>
      </div>
    </figure>
  )
}
