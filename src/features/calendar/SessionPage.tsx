import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Dumbbell } from 'lucide-react'
import { dateLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { GlossaryText } from '../../lib/glossary'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StreamCharts } from '../../components/StreamCharts'
import { startWorkout } from '../gym/api'
import { GymSessionPreview } from '../gym/GymSessionPreview'
import { ExportMenu } from './ExportMenu'
import { ActivityShoeRow } from '../shoes/ActivityShoeRow'
import { fetchShoes } from '../shoes/api'
import { ShoePicker } from '../shoes/ShoePicker'
import { fetchStravaActivities } from '../strava/api'
import {
  fetchPaceModel,
  fetchSession,
  fetchSessionProposal,
  fetchSessionStreams,
  updateSession,
  validateSession,
  validateSessionFromStrava,
  type PerceivedEffort,
  type SessionProposal,
  type SessionResponse,
  type ValidateSessionRequest,
  type WorkoutNode,
} from './api'
import {
  allureHrBand,
  allurePaceBand,
  disciplineLabel,
  EFFORTS,
  effortLabel,
  cleanTitle,
  isPending,
  formatDuration,
  formatSeconds,
  totalWorkoutSeconds,
  zoneAllure,
} from './labels'
import { WorkoutTree } from './WorkoutView'
import {
  WorkoutBuilder,
  draftsError,
  draftsToNodes,
  nodesToDrafts,
  type ItemDraft,
} from './WorkoutBuilder'

function formatPace(durationMin: number, distanceKm: number | null): string | null {
  if (!distanceKm || distanceKm <= 0) return null
  const secPerKm = Math.round((durationMin * 60) / distanceKm)
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`
}

/* ── Page ──────────────────────────────────────────────────────────── */

export function SessionPage() {
  const { t } = useTranslation('calendar')
  const params = useParams({ strict: false }) as { sessionId?: string }
  const search = useSearch({ strict: false }) as { from?: string }
  const sessionId = params.sessionId!
  const queryClient = useQueryClient()

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
        to="/planning"
        search={search.from ? { week: search.from } : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
      >
        ← {t('session.back')}
      </Link>

      {query.isLoading && (
        <p className="mt-10 text-center text-moss-500 dark:text-moss-400">{t('common:loading')}</p>
      )}
      {query.isError && (
        <p className="mt-10 text-center text-clay-500 dark:text-clay-300">
          {t('session.notFound')}
        </p>
      )}

      {session && (
        <SessionView session={session} statusMutation={statusMutation} onDone={invalidate} />
      )}
      {statusMutation.isError && (
        <p role="alert" className="mt-3 text-sm text-clay-500 dark:text-clay-300">
          {t('session.actionFailed')}
        </p>
      )}
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
  const { t } = useTranslation('calendar')
  const [editingStructure, setEditingStructure] = useState(false)

  // derived road pace bands — the query is cheap and cached; bands render
  // only when the season's main objective is ROAD
  const paceQuery = useQuery({
    queryKey: ['pace-model'],
    queryFn: fetchPaceModel,
    staleTime: 5 * 60_000,
    enabled: session.discipline === 'RUN',
  })
  const pace = paceQuery.data ?? null

  const totalSec =
    session.status === 'DONE' && session.actualDurationMin != null
      ? session.actualDurationMin * 60
      : session.workout.length > 0
        ? totalWorkoutSeconds(session.workout)
        : (session.durationMin ?? 0) * 60
  const isValidated = session.status === 'DONE' && session.activity != null
  const consignes = session.structureNotes ?? session.detail

  return (
    <div className="mt-4">
      {/* ── Header ── */}
      <p className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {format(parseISO(session.date), 'EEEE d MMMM', { locale: dateLocale() })} ·{' '}
        {disciplineLabel(session.discipline)}
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
          {t(`session.status.${session.status}`)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {totalSec > 0 && <HeaderChip label={t('session.chipDuration')} value={formatSeconds(totalSec)!} />}
        {session.elevationM != null && <HeaderChip label={t('session.chipElevation')} value={`${session.elevationM} m`} />}
        {session.rpeMin != null && (
          <HeaderChip
            label={t('session.chipRpe')}
            value={`${session.rpeMin}${session.rpeMax !== session.rpeMin ? `–${session.rpeMax}` : ''}`}
          />
        )}
        {session.zone && <HeaderChip label={t('session.chipZone')} value={session.zone} />}
        {session.discipline === 'RUN' &&
          (() => {
            const allure = zoneAllure(session.zone)
            const band = allurePaceBand(pace, allure)
            const hr = allureHrBand(pace, allure)
            return (
              <>
                {band && <HeaderChip label={t('session.chipPace')} value={band.label} />}
                {hr && <HeaderChip label={t('session.chipHr')} value={hr} />}
              </>
            )
          })()}
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
                {t('session.instructions')}
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
            <>
              {/* What the session is made of — the gym counterpart of the
                  running workout tree, so both disciplines answer "what am I
                  about to do?" before the start button. */}
              {session.discipline === 'GYM' && session.templateVariantId && (
                <GymSessionPreview variantId={session.templateVariantId} />
              )}
              {session.discipline === 'RUN' && (
                <div className="mt-5">
                  {session.workout.length > 0 ? (
                    <WorkoutTree nodes={session.workout} pace={pace} />
                  ) : (
                    <p className="text-sm text-moss-400 dark:text-moss-500">
                      {t('session.noStructure')}
                    </p>
                  )}
                  <button
                    onClick={() => setEditingStructure(true)}
                    className="mt-1.5 text-xs font-medium text-moss-400 hover:text-ink hover:underline dark:text-moss-500 dark:hover:text-linen"
                  >
                    {session.workout.length > 0
                      ? t('session.editStructure')
                      : t('session.createStructure')}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Actions ── */}
          {!editingStructure && (
            <SessionActions
              session={session}
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
  | { kind: 'bike' }
  | { kind: 'move' }
  | { kind: 'effort'; payload: { strava?: number; manual?: Omit<ValidateSessionRequest, 'perceivedEffort' | 'comment'> } }

function SessionActions({
  session,
  statusMutation,
  onValidated,
}: {
  session: SessionResponse
  statusMutation: { mutate: (b: { status?: SessionResponse['status']; date?: string }) => void; isPending: boolean }
  onValidated: () => void
}) {
  const { t } = useTranslation('calendar')
  const [step, setStep] = useState<WizardStep>({ kind: 'none' })
  const [proposalDismissed, setProposalDismissed] = useState(false)
  const [confirming, setConfirming] = useState<'skip' | 'unvalidate' | null>(null)

  const proposalQuery = useQuery({
    queryKey: ['session-proposal', session.id],
    queryFn: () => fetchSessionProposal(session.id),
    enabled: session.discipline === 'RUN' && isPending(session.status),
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
      shoeId?: string
    }) => validateSessionFromStrava(session.id, body),
    onSuccess: onValidated,
  })

  const pending = statusMutation.isPending || validateMutation.isPending || stravaMutation.isPending

  if (step.kind === 'choose') {
    return (
      <WizardShell title={t('wizard.howToValidate')} onCancel={() => setStep({ kind: 'none' })}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStep({ kind: 'strava' })}
            className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502]"
          >
            {t('wizard.importStrava')}
          </button>
          <button
            onClick={() => setStep({ kind: 'manual' })}
            className="rounded-lg border border-pine-600/50 px-4 py-2 text-sm font-semibold text-pine-700 transition hover:bg-pine-100 dark:text-pine-300 dark:hover:bg-pine-900"
          >
            {t('wizard.manualEntry')}
          </button>
        </div>
      </WizardShell>
    )
  }

  if (step.kind === 'strava') {
    return (
      <WizardShell title={t('wizard.stravaTitle')} onCancel={() => setStep({ kind: 'none' })}>
        <StravaPicker onPick={(id) => setStep({ kind: 'effort', payload: { strava: id } })} />
      </WizardShell>
    )
  }

  if (step.kind === 'manual') {
    return (
      <WizardShell title={t('wizard.manualTitle')} onCancel={() => setStep({ kind: 'none' })}>
        <ManualForm
          session={session}
          onSubmit={(measures) => setStep({ kind: 'effort', payload: { manual: measures } })}
        />
      </WizardShell>
    )
  }

  if (step.kind === 'bike') {
    return (
      <WizardShell title={t('wizard.bikeTitle')} onCancel={() => setStep({ kind: 'none' })}>
        <BikeForm
          session={session}
          pending={pending}
          error={validateMutation.isError}
          onSubmit={(durationMin, distanceKm) =>
            validateMutation.mutate({ durationMin, distanceKm })
          }
        />
      </WizardShell>
    )
  }

  if (step.kind === 'move') {
    return (
      <WizardShell title={t('wizard.moveTitle')} onCancel={() => setStep({ kind: 'none' })}>
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
            {t('wizard.newDate')}
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
            {t('session.move')}
          </button>
        </form>
      </WizardShell>
    )
  }

  if (step.kind === 'effort') {
    return (
      <WizardShell title={t('wizard.effortTitle')} onCancel={() => setStep({ kind: 'none' })}>
        <EffortForm
          pending={pending}
          error={validateMutation.isError || stravaMutation.isError}
          askShoe={step.payload.strava != null}
          onSubmit={(perceivedEffort, painFlag, comment, shoeId) => {
            if (step.payload.strava != null) {
              stravaMutation.mutate({
                stravaActivityId: step.payload.strava,
                perceivedEffort,
                painFlag,
                comment,
                shoeId,
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
      <div className="sticky bottom-[var(--tab-bar-h)] z-30 -mx-4 mt-6 border-t border-moss-200 bg-moss-50/95 px-4 py-3 backdrop-blur md:static md:z-auto md:mx-0 md:bg-transparent md:px-0 md:pt-4 md:pb-0 md:backdrop-blur-none dark:border-moss-750 dark:bg-moss-900/95 dark:md:bg-transparent">
      <div className="flex flex-wrap gap-2">
      {session.discipline === 'RUN' && <ExportMenu session={session} size="md" />}
      {session.discipline === 'GYM' && isPending(session.status) && session.templateVariantId && (
        <StartWorkoutButton sessionId={session.id} />
      )}
      {isPending(session.status) && (
        <>
          <button
            onClick={() =>
              session.discipline === 'RUN' || session.discipline === 'HIKE'
                ? setStep({ kind: 'choose' })
                : session.discipline === 'CROSS'
                  ? setStep({ kind: 'bike' })
                  : statusMutation.mutate({ status: 'DONE' })
            }
            disabled={pending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {t('session.validate')}
          </button>
          <button
            onClick={() => setConfirming('skip')}
            disabled={pending}
            className="rounded-lg border border-clay-500/40 px-4 py-2 text-sm font-semibold text-clay-500 transition hover:bg-clay-100 disabled:opacity-50 dark:text-clay-300 dark:hover:bg-clay-900"
          >
            {t('session.skip')}
          </button>
          <button
            onClick={() => setStep({ kind: 'move' })}
            disabled={pending}
            className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
          >
            {t('session.move')}
          </button>
        </>
      )}
      {session.status === 'SKIPPED' && (
        <button
          onClick={() => statusMutation.mutate({ status: 'PLANNED' })}
          disabled={pending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          {t('session.undoSkip')}
        </button>
      )}
      {session.status === 'DONE' && (
        <button
          onClick={() => setConfirming('unvalidate')}
          disabled={pending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          {t('session.backToPlanned')}
        </button>
      )}
      </div>
      </div>
      {confirming === 'skip' && (
        <ConfirmDialog
          title={t('session.skip')}
          message={t('session.skipConfirm')}
          confirmLabel={t('session.skip')}
          danger
          busy={statusMutation.isPending}
          onConfirm={() => {
            setConfirming(null)
            statusMutation.mutate({ status: 'SKIPPED' })
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'unvalidate' && (
        <ConfirmDialog
          title={t('session.backToPlanned')}
          message={t('session.unvalidateConfirm')}
          confirmLabel={t('session.backToPlanned')}
          danger
          busy={statusMutation.isPending}
          onConfirm={() => {
            setConfirming(null)
            statusMutation.mutate({ status: 'PLANNED' })
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  )
}

/** GYM: one tap opens the live workout — finishing it validates the session. */
function StartWorkoutButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation('calendar')
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
      className="inline-flex items-center gap-1.5 rounded-lg bg-copper-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:opacity-90 disabled:opacity-50 dark:bg-copper-300 dark:text-moss-950"
    >
      <Dumbbell size={14} aria-hidden />
      {mutation.isPending ? t('session.starting') : t('session.startWorkout')}
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
  const { t } = useTranslation('calendar')
  const pace = formatPace(proposal.durationMin, proposal.distanceKm)
  const facts = [
    format(parseISO(proposal.date), 'EEEE d MMMM', { locale: dateLocale() }),
    formatDuration(proposal.durationMin),
    proposal.distanceKm != null ? `${proposal.distanceKm} km` : null,
    pace,
    proposal.elevationM ? `${proposal.elevationM} m D+` : null,
  ].filter(Boolean)

  return (
    <div className="mb-4 rounded-xl border border-[#fc4c02]/30 bg-[#fc4c02]/5 p-3 dark:bg-[#fc4c02]/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{t('proposal.matches')}</span>{' '}
          {proposal.name ?? t('proposal.run')}
          <span className="mt-0.5 block text-xs text-moss-500 dark:text-moss-400">
            {facts.join(' · ')}
          </span>
        </p>
        <button
          onClick={onDismiss}
          aria-label={t('proposal.dismiss')}
          className="rounded p-1 text-xs text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          ✕
        </button>
      </div>
      <button
        onClick={onValidate}
        className="mt-2 rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04502]"
      >
        {t('proposal.validateRun')}
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
  const { t } = useTranslation('calendar')
  return (
    <div className="mt-6 border-t border-moss-200 pt-4 dark:border-moss-750">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button
          onClick={onCancel}
          className="text-xs font-medium text-moss-500 hover:underline dark:text-moss-400"
        >
          {t('common:cancel')}
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function StravaPicker({ onPick }: { onPick: (id: number) => void }) {
  const { t } = useTranslation('calendar')
  const activities = useQuery({
    queryKey: ['strava-activities'],
    queryFn: fetchStravaActivities,
    staleTime: 60_000,
    retry: false,
  })
  const notConnected = activities.error instanceof ApiError && activities.error.status === 409

  if (activities.isLoading)
    return <p className="text-sm text-moss-500 dark:text-moss-400">{t('wizard.loadingActivities')}</p>
  if (notConnected)
    return (
      <p className="text-sm text-moss-500 dark:text-moss-400">
        {t('wizard.stravaNotConnected')}{' '}
        <Link to="/parametres" className="font-medium text-pine-700 underline dark:text-pine-300">
          {t('wizard.connectInSettings')}
        </Link>
      </p>
    )
  if (activities.isError)
    return (
      <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
        {t('wizard.activitiesError')}
      </p>
    )
  if (!activities.data || activities.data.length === 0)
    return (
      <p className="text-sm text-moss-500 dark:text-moss-400">
        {t('wizard.noActivities')}
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
            {format(parseISO(a.date), 'EEE d MMM', { locale: dateLocale() })} ·{' '}
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
  const { t } = useTranslation('calendar')
  const [error, setError] = useState<string | null>(null)
  const shoes = useQuery({ queryKey: ['shoes'], queryFn: fetchShoes, staleTime: 60_000, retry: false })
  const activeShoes = (shoes.data ?? []).filter((s) => !s.retired)
  // Pre-select the athlete's default pair when they have one; null = untouched.
  const defaultShoeId = activeShoes.find((s) => s.isDefault)?.id ?? ''
  const [shoeSel, setShoeSel] = useState<string | null>(null)
  const effectiveShoeId = shoeSel ?? defaultShoeId
  const inputCls =
    'mt-0.5 w-full rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const durationMin = Number(data.get('durationMin'))
    const distanceKm = Number(data.get('distanceKm'))
    if (!durationMin || durationMin <= 0 || !distanceKm || distanceKm <= 0) {
      setError(t('wizard.measuresRequired'))
      return
    }
    setError(null)
    onSubmit({
      durationMin,
      distanceKm,
      elevationM: data.get('elevationM') ? Number(data.get('elevationM')) : undefined,
      avgHr: data.get('avgHr') ? Number(data.get('avgHr')) : undefined,
      shoeId: effectiveShoeId || undefined,
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
          {t('wizard.durationLabel')}
          <input name="durationMin" type="number" min="1" required
            defaultValue={session.durationMin ?? ''} className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.distanceLabel')}
          <input name="distanceKm" type="number" min="0.1" step="0.01" required className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.elevationLabel')}
          <input name="elevationM" type="number" min="0" className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.avgHrLabel')}
          <input name="avgHr" type="number" min="30" max="250" className={inputCls} />
        </label>
        {activeShoes.length > 0 && (
          <div className="col-span-2 block text-xs text-moss-500 dark:text-moss-400">
            {t('wizard.shoeLabel')}
            <ShoePicker
              shoes={activeShoes}
              value={effectiveShoeId || null}
              onChange={(id) => setShoeSel(id ?? '')}
              label={t('wizard.shoeLabel')}
            />
          </div>
        )}
      </div>
      <button
        type="submit"
        className="mt-3 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {t('wizard.continue')}
      </button>
    </form>
  )
}

/** Cross-training bike: one form, time + distance, straight to validation. */
function BikeForm({
  session,
  pending,
  error,
  onSubmit,
}: {
  session: SessionResponse
  pending: boolean
  error: boolean
  onSubmit: (durationMin: number, distanceKm: number) => void
}) {
  const { t } = useTranslation('calendar')
  const [formError, setFormError] = useState<string | null>(null)
  const inputCls =
    'mt-0.5 w-full rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const durationMin = Number(data.get('durationMin'))
    const distanceKm = Number(data.get('distanceKm'))
    if (!durationMin || durationMin <= 0 || !distanceKm || distanceKm <= 0) {
      setFormError(t('wizard.measuresRequired'))
      return
    }
    setFormError(null)
    onSubmit(durationMin, distanceKm)
  }

  return (
    <form onSubmit={handleSubmit}>
      {(formError || error) && (
        <p role="alert" className="mb-2 text-sm text-clay-500 dark:text-clay-300">
          {formError ?? t('wizard.validateFailed')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.durationLabel')}
          <input name="durationMin" type="number" min="1" required
            defaultValue={session.durationMin ?? ''} className={inputCls} />
        </label>
        <label className="block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.distanceLabel')}
          <input name="distanceKm" type="number" min="0.1" step="0.01" required className={inputCls} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {pending ? t('wizard.validating') : t('wizard.validateSession')}
      </button>
    </form>
  )
}

function EffortForm({
  pending,
  error,
  askShoe = false,
  onSubmit,
}: {
  pending: boolean
  error: boolean
  /** The Strava path skips the measures form, so the shoe is asked here. */
  askShoe?: boolean
  onSubmit: (effort: PerceivedEffort, painFlag: boolean, comment?: string, shoeId?: string) => void
}) {
  const { t } = useTranslation('calendar')
  const [effort, setEffort] = useState<PerceivedEffort>('COMME_PREVU')
  const [pain, setPain] = useState(false)
  const [comment, setComment] = useState('')
  const shoes = useQuery({
    queryKey: ['shoes'],
    queryFn: fetchShoes,
    enabled: askShoe,
    staleTime: 60_000,
    retry: false,
  })
  const activeShoes = (shoes.data ?? []).filter((s) => !s.retired)
  // Pre-select the athlete's default pair when they have one.
  const [shoeId, setShoeId] = useState<string | null>(null)
  const effectiveShoeId = shoeId ?? activeShoes.find((s) => s.isDefault)?.id ?? ''

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-clay-500 dark:text-clay-300">
          {t('wizard.validateFailed')}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('wizard.effortAria')}>
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
            {effortLabel(e)}
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
          {t('wizard.pain')}
        </span>
      </label>
      {askShoe && activeShoes.length > 0 && (
        <div className="mt-3 block text-xs text-moss-500 dark:text-moss-400">
          {t('wizard.shoeLabel')}
          <ShoePicker
            shoes={activeShoes}
            value={effectiveShoeId || null}
            onChange={(id) => setShoeId(id ?? '')}
            label={t('wizard.shoeLabel')}
          />
        </div>
      )}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder={t('wizard.commentPlaceholder')}
        className="mt-3 w-full rounded-lg border border-moss-200 bg-moss-100 p-2.5 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
      />
      <button
        onClick={() =>
          onSubmit(effort, pain, comment.trim() || undefined,
            askShoe ? effectiveShoeId || undefined : undefined)
        }
        disabled={pending}
        className="mt-2 rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {pending ? t('wizard.validating') : t('wizard.validateSession')}
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
  const { t } = useTranslation('calendar')
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
      <p className="text-sm font-semibold">{t('session.structureTitle')}</p>
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
          {t('session.saveStructure')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          {t('common:cancel')}
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
  const { t } = useTranslation('calendar')
  const queryClient = useQueryClient()
  const [confirmingUnvalidate, setConfirmingUnvalidate] = useState(false)
  const activity = session.activity!
  const streams = useQuery({
    queryKey: ['session-streams', session.id],
    queryFn: () => fetchSessionStreams(session.id),
    enabled: activity.hasStreams,
    staleTime: Infinity,
    retry: false,
  })

  const tiles: { label: string; value: string }[] = [
    activity.distanceKm != null && { label: t('report.distance'), value: `${activity.distanceKm} km` },
    { label: t('report.time'), value: formatDuration(activity.durationMin) ?? '—' },
    activity.distanceKm != null && {
      label: t('report.avgPace'),
      value: formatPace(activity.durationMin, activity.distanceKm) ?? '—',
    },
    activity.elevationM != null && { label: t('report.elevation'), value: `${activity.elevationM} m` },
    activity.avgHr != null && { label: t('report.avgHr'), value: `${activity.avgHr} bpm` },
    activity.avgCadenceSpm != null && {
      label: t('report.cadence'),
      value: `${Math.round(activity.avgCadenceSpm)} spm`,
    },
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

      {/* shoe: visible and fixable after the fact */}
      {session.discipline === 'RUN' && (
        <ActivityShoeRow
          activityId={activity.activityId}
          shoeId={activity.shoeId}
          onSaved={() =>
            void queryClient.invalidateQueries({ queryKey: ['session', session.id] })
          }
        />
      )}

      {/* effort + comment */}
      <div className="mt-3 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
        <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {t('report.feeling')}
        </p>
        <p className="mt-0.5 text-sm font-medium">
          {activity.perceivedEffort ? effortLabel(activity.perceivedEffort) : '—'}
          {activity.painFlag && (
            <span className="ml-2 rounded-full bg-clay-100 px-2 py-0.5 text-xs font-semibold text-clay-600 dark:bg-clay-900 dark:text-clay-300">
              {t('report.painReported')}
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
      {activity.hasStreams && streams.data && (
        <StreamCharts streams={streams.data} workout={session.workout} />
      )}
      {activity.hasStreams && streams.isLoading && (
        <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">{t('report.loadingCharts')}</p>
      )}

      <div className="mt-6 flex gap-2 border-t border-moss-200 pt-4 dark:border-moss-750">
        <button
          onClick={() => setConfirmingUnvalidate(true)}
          disabled={statusMutation.isPending}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium text-moss-500 transition hover:bg-moss-100 disabled:opacity-50 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          {t('session.backToPlanned')}
        </button>
      </div>
      {confirmingUnvalidate && (
        <ConfirmDialog
          title={t('session.backToPlanned')}
          message={t('session.unvalidateConfirm')}
          confirmLabel={t('session.backToPlanned')}
          danger
          busy={statusMutation.isPending}
          onConfirm={() => {
            setConfirmingUnvalidate(false)
            statusMutation.mutate({ status: 'PLANNED' })
          }}
          onCancel={() => setConfirmingUnvalidate(false)}
        />
      )}
    </div>
  )
}

