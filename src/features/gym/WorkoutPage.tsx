import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { muted } from '../../lib/ui'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import {
  abandonWorkout,
  addExtraBlock,
  adjustBlockSets,
  adjustExtraBlockSets,
  deleteSet,
  fetchExercises,
  fetchWorkout,
  finishWorkout,
  logSet,
  removeExtraBlock,
  restoreWorkoutBlock,
  skipWorkoutBlock,
  swapWorkoutBlock,
  type ExerciseResponse,
  type PerceivedEffort,
  type SetLogResponse,
  type WorkoutBlockResponse,
  type WorkoutDetailResponse,
} from './api'
import { CATEGORY_BADGE, CATEGORY_EDGE, categoryLabel, formatRest, muscleLabel } from './labels'

const inputCls =
  'w-full rounded-lg border border-moss-200 bg-moss-100 px-2 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

/** 40px touch targets — mid-workout taps are made with shaky thumbs. */
const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-moss-200 text-moss-500 transition hover:bg-moss-100 hover:text-ink disabled:opacity-40 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen'

const EFFORTS: PerceivedEffort[] = [
  'TROP_FACILE', 'FACILE', 'COMME_PREVU', 'DIFFICILE', 'TROP_DIFFICILE',
]

/* ── Inline icons (no icon dependency; stroke follows the text color) ── */

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
  )
}

function formatElapsed(startedAt: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function formatCountdown(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Rows to render for a block: the effective sets, never hiding a logged set. */
function totalRows(block: WorkoutBlockResponse, loggedSets: SetLogResponse[]): number {
  const maxLogged = loggedSets
    .filter((s) => s.exerciseId === block.exercise.id)
    .reduce((max, s) => Math.max(max, s.setNumber), 0)
  return Math.max(block.sets, maxLogged)
}

/**
 * "Last time every set hit the target at weight w" → suggest w + 2.5 kg.
 * Null when the history is incomplete or the exercise isn't weight-based.
 */
function progressionHint(block: WorkoutBlockResponse): number | null {
  if (block.targetReps == null || block.prescribedSets === 0) return null
  const done = block.lastSets.filter((s) => s.reps != null)
  if (done.length < block.prescribedSets) return null
  if (!done.every((s) => (s.reps ?? 0) >= (block.targetReps ?? 0))) return null
  const weights = done.map((s) => s.weightKg).filter((w): w is number => w != null && w > 0)
  if (weights.length < done.length) return null
  return Math.max(...weights) + 2.5
}

/** The live workout: tick a set, it's saved; lock your phone, nothing is lost. */
export function WorkoutPage() {
  const { t } = useTranslation('gym')
  const params = useParams({ strict: false }) as { workoutId?: string }
  const workoutId = params.workoutId!
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [finishing, setFinishing] = useState(false)
  const [addingExercise, setAddingExercise] = useState(false)

  const query = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => fetchWorkout(workoutId),
  })

  const detail = query.data

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!detail) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('workout.notFound')}</p>
    )
  }

  const finished = detail.log.status === 'FINISHED'
  const circuit = detail.circuitLoops != null
  const templateBlocks = detail.blocks.filter((b) => b.templateExerciseId != null)
  const extraBlocks = detail.blocks.filter((b) => b.extraBlockId != null)

  return (
    <div className="mx-auto mt-4 max-w-2xl pb-10">
      <WorkoutHeader
        detail={detail}
        finished={finished}
        onFinish={() => setFinishing(true)}
      />

      {finished && (
        <p className="mt-4 rounded-lg bg-pine-100 p-3 text-sm font-medium text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          {t('workout.finishedIn', { min: detail.log.durationMin })}{' '}
          {detail.log.sessionId && (
            <Link
              to="/session/$sessionId"
              params={{ sessionId: detail.log.sessionId }}
              className="underline"
            >
              {t('workout.viewSession')}
            </Link>
          )}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {circuit ? (
          <CircuitView workoutId={workoutId} detail={detail} readOnly={finished} />
        ) : (
          templateBlocks.map((block) => (
            <BlockCard key={block.templateExerciseId} workoutId={workoutId}
              block={block} loggedSets={detail.log.sets} readOnly={finished} />
          ))
        )}
        {extraBlocks.map((block) => (
          <BlockCard key={block.extraBlockId} workoutId={workoutId}
            block={block} loggedSets={detail.log.sets} readOnly={finished} />
        ))}
        {detail.blocks.length === 0 && (
          <p className={`text-center text-sm ${muted}`}>
            {t('workout.templateGone')}
          </p>
        )}
        {!finished && (
          <button
            onClick={() => setAddingExercise(true)}
            className={`w-full rounded-xl border border-dashed border-moss-200 px-3 py-2.5 text-sm font-medium ${muted} transition hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800`}
          >
            {t('workout.addExercise')}
          </button>
        )}
      </div>

      {addingExercise && !finished && (
        <AddExerciseModal
          workoutId={workoutId}
          blocks={detail.blocks}
          onClose={() => setAddingExercise(false)}
        />
      )}

      {finishing && !finished && (
        <FinishPanel
          detail={detail}
          onDone={(sessionId) => {
            void queryClient.invalidateQueries()
            if (sessionId) {
              void navigate({ to: '/session/$sessionId', params: { sessionId } })
            } else {
              void navigate({ to: '/renfo' })
            }
          }}
          onCancel={() => setFinishing(false)}
        />
      )}
    </div>
  )
}

function WorkoutHeader({
  detail,
  finished,
  onFinish,
}: {
  detail: WorkoutDetailResponse
  finished: boolean
  onFinish: () => void
}) {
  const { t } = useTranslation('gym')
  const [, forceTick] = useState(0)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (finished) return
    const interval = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [finished])

  const abandonMutation = useMutation({
    mutationFn: () => abandonWorkout(detail.log.id),
    onSuccess: () => void navigate({ to: '/renfo' }),
  })

  const circuitRest = detail.circuitRestSec != null ? formatRest(detail.circuitRestSec) : null

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-moss-200 bg-moss-50/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border dark:border-moss-750 dark:bg-moss-900/95">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">
            {detail.log.templateName ?? t('workout.untitled')}
          </p>
          <p className={`text-sm tabular-nums ${muted}`}>
            {!finished && <>⏱ {formatElapsed(detail.log.startedAt)}</>}
            {detail.circuitLoops != null && (
              <span className="ml-2 rounded-full bg-teal-600/15 px-2 py-0.5 text-xs font-medium text-teal-600 dark:bg-teal-300/15 dark:text-teal-300">
                {t('workout.circuitTag', { loops: detail.circuitLoops })}
                {circuitRest != null && ` · ${circuitRest}`}
              </span>
            )}
          </p>
        </div>
        {!finished && (
          <>
            <button
              onClick={() => setConfirmingAbandon(true)}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-clay-500 transition hover:bg-clay-100 dark:text-clay-300 dark:hover:bg-clay-900"
            >
              {t('workout.abandon')}
            </button>
            {confirmingAbandon && (
              <ConfirmDialog
                title={t('workout.abandon')}
                message={t('workout.abandonConfirm')}
                confirmLabel={t('workout.abandon')}
                danger
                busy={abandonMutation.isPending}
                onConfirm={() => abandonMutation.mutate()}
                onCancel={() => setConfirmingAbandon(false)}
              />
            )}
            <button
              onClick={onFinish}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {t('workout.finish')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Rest countdown with quick controls ─────────────────────────────── */

function RestTimer({
  secondsLeft,
  onExtend,
  onSkip,
}: {
  secondsLeft: number
  onExtend: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation('gym')
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-copper-600/15 px-3 py-1.5 dark:bg-copper-300/15">
      <p className="flex-1 text-sm font-semibold text-copper-600 tabular-nums dark:text-copper-300">
        {t('workout.restCountdown', { time: formatCountdown(secondsLeft) })}
      </p>
      <button
        onClick={onExtend}
        className="rounded-full px-2.5 py-1 text-xs font-semibold text-copper-600 transition hover:bg-copper-600/15 dark:text-copper-300 dark:hover:bg-copper-300/15"
      >
        {t('workout.restPlus30')}
      </button>
      <button
        onClick={onSkip}
        className="rounded-full px-2.5 py-1 text-xs font-medium text-copper-600/80 transition hover:bg-copper-600/15 dark:text-copper-300/80 dark:hover:bg-copper-300/15"
      >
        {t('workout.restSkip')}
      </button>
    </div>
  )
}

/** Shared countdown state: ticks every second, vibrates at zero. */
function useRestCountdown() {
  const [restLeft, setRestLeft] = useState<number | null>(null)
  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return
    const timer = setTimeout(() => {
      const next = restLeft - 1
      setRestLeft(next > 0 ? next : null)
      if (next <= 0 && 'vibrate' in navigator) navigator.vibrate?.(300)
    }, 1000)
    return () => clearTimeout(timer)
  }, [restLeft])
  return { restLeft, setRestLeft }
}

/* ── Sets stepper: the set count is elastic, persisted, floor at zero ── */

function SetsStepper({
  block,
  workoutId,
}: {
  block: WorkoutBlockResponse
  workoutId: string
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (sets: number) =>
      block.templateExerciseId != null
        ? adjustBlockSets(workoutId, block.templateExerciseId, sets)
        : adjustExtraBlockSets(workoutId, block.extraBlockId!, sets),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] }),
  })
  const adjusted = block.sets !== block.prescribedSets

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-lg border border-moss-200 dark:border-moss-750">
        <button
          onClick={() => mutation.mutate(block.sets - 1)}
          disabled={block.sets <= 0 || mutation.isPending}
          aria-label={t('workout.removeSetAria')}
          className="grid h-10 w-11 place-items-center text-lg font-semibold text-moss-500 transition hover:bg-moss-100 disabled:opacity-30 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          −
        </button>
        <span className="min-w-20 border-x border-moss-200 px-2 text-center text-sm font-semibold tabular-nums dark:border-moss-750">
          {t('workout.setsCount', { count: block.sets })}
        </span>
        <button
          onClick={() => mutation.mutate(block.sets + 1)}
          disabled={block.sets >= 10 || mutation.isPending}
          aria-label={t('workout.addSetAria')}
          className="grid h-10 w-11 place-items-center text-lg font-semibold text-moss-500 transition hover:bg-moss-100 disabled:opacity-30 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          +
        </button>
      </div>
      {adjusted && (
        <span className={`text-xs ${muted}`}>
          {t('workout.prescribedSets', { count: block.prescribedSets })}
        </span>
      )}
      {mutation.error instanceof ApiError && (
        <span role="alert" className="text-xs text-clay-500 dark:text-clay-300">
          {t('workout.adjustFailed')}
        </span>
      )}
    </div>
  )
}

/* ── Replace modal: declared alternatives first, then ranked suggestions ── */

function ReplaceModal({
  workoutId,
  block,
  onClose,
}: {
  workoutId: string
  block: WorkoutBlockResponse
  onClose: () => void
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const prescribed = block.swappedFrom ?? block.exercise

  const mutation = useMutation({
    mutationFn: (exerciseId: string) =>
      swapWorkoutBlock(workoutId, block.templateExerciseId!, exerciseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })
      onClose()
    },
  })

  const option = (exercise: ExerciseResponse, current: boolean) => (
    <button
      key={exercise.id}
      onClick={() => (current ? onClose() : mutation.mutate(exercise.id))}
      disabled={mutation.isPending}
      aria-pressed={current}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50 ${
        current
          ? 'border-pine-600 bg-pine-100/60 dark:border-pine-350 dark:bg-pine-900/40'
          : 'border-moss-200 hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{exercise.name}</span>
        <span className={`block truncate text-xs ${muted}`}>
          {exercise.muscles.map(muscleLabel).join(' · ')}
        </span>
      </span>
      {current && (
        <span className="shrink-0 text-xs font-semibold text-pine-700 dark:text-pine-300">
          {t('workout.currentExercise')}
        </span>
      )}
    </button>
  )

  return (
    <Modal
      title={t('workout.replaceTitle')}
      subtitle={t('workout.replaceSubtitle', { name: prescribed.name })}
      onClose={onClose}
    >
      <div className="space-y-2">
        {option(prescribed, block.swappedFrom == null)}
        {block.swappedFrom != null && option(block.exercise, true)}

        {block.alternatives.length > 0 && (
          <>
            <p className={`pt-1 text-xs font-semibold tracking-wide uppercase ${muted}`}>
              {t('workout.declaredAlternatives')}
            </p>
            {block.alternatives
              .filter((alt) => alt.id !== block.exercise.id)
              .map((alt) => option(alt, false))}
          </>
        )}

        {block.suggestedAlternatives.length > 0 && (
          <>
            <p className={`pt-1 text-xs font-semibold tracking-wide uppercase ${muted}`}>
              {t('workout.suggestedAlternatives')}
            </p>
            {block.suggestedAlternatives.map((alt) => option(alt, false))}
          </>
        )}

        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-xs text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
      </div>
    </Modal>
  )
}

/* ── One exercise block (classic sets×reps mode) ────────────────────── */

function BlockCard({
  workoutId,
  block,
  loggedSets,
  readOnly,
}: {
  workoutId: string
  block: WorkoutBlockResponse
  loggedSets: SetLogResponse[]
  readOnly: boolean
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const [replacing, setReplacing] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const { restLeft, setRestLeft } = useRestCountdown()

  const exercise = block.exercise
  const swapped = block.swappedFrom != null
  const isExtra = block.extraBlockId != null
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })

  const skipMutation = useMutation({
    mutationFn: () => skipWorkoutBlock(workoutId, block.templateExerciseId!),
    onSuccess: invalidate,
  })
  const restoreMutation = useMutation({
    mutationFn: () => restoreWorkoutBlock(workoutId, block.templateExerciseId!),
    onSuccess: invalidate,
  })
  const removeExtraMutation = useMutation({
    mutationFn: () => removeExtraBlock(workoutId, block.extraBlockId!),
    onSuccess: invalidate,
  })

  const rows = totalRows(block, loggedSets)

  if (block.skipped) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-moss-200 bg-moss-25/60 px-3 py-2.5 dark:border-moss-750 dark:bg-moss-850/60">
        <p className={`min-w-0 flex-1 truncate text-sm line-through ${muted}`}>{exercise.name}</p>
        <span className={`shrink-0 text-xs ${muted}`}>{t('workout.skipped')}</span>
        {!readOnly && (
          <button
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-pine-700 transition hover:bg-pine-100 disabled:opacity-50 dark:text-pine-300 dark:hover:bg-pine-900"
          >
            {t('workout.restoreBlock')}
          </button>
        )}
      </div>
    )
  }

  const seconds = exercise.measure === 'SECONDS'

  const target = seconds
    ? `${block.sets} × ${block.targetSeconds ?? '?'} sec`
    : `${block.sets} × ${block.targetReps ?? '?'}`
  const prescription = [
    target,
    block.intensityPct != null ? `${block.intensityPct} %` : null,
    formatRest(block.restSec),
    block.note,
  ].filter(Boolean).join(' · ')

  const lastLine = block.lastSets.length > 0
    ? t('workout.lastTime', {
        values: block.lastSets
          .map((s) => (s.seconds != null ? `${s.seconds}s` : `${s.weightKg ?? t('workout.bodyweight')}${s.weightKg != null ? ' kg' : ''}`))
          .join(' / '),
      })
    : null
  const recordLine = block.recordWeightKg != null
    ? t('workout.record', { weight: block.recordWeightKg, reps: block.targetReps })
    : null
  const nextWeight = !readOnly && !seconds ? progressionHint(block) : null

  return (
    <div
      className={`rounded-xl border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[exercise.category]}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => setDetailOpen(true)}
          className="min-w-0 flex-1 text-left"
          aria-label={t('workout.detailsAria', { name: exercise.name })}
        >
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="inline-flex items-center gap-1 font-medium">
              {exercise.name}
              <span className={muted}><InfoIcon /></span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[exercise.category]}`}>
              {categoryLabel(exercise.category)}
            </span>
            {isExtra && (
              <span className="rounded-full bg-copper-600/15 px-2 py-0.5 text-[11px] font-medium text-copper-600 dark:bg-copper-300/15 dark:text-copper-300">
                {t('workout.extraTag')}
              </span>
            )}
          </span>
          {swapped && (
            <span className={`block text-xs ${muted}`}>{t('workout.insteadOf', { name: block.swappedFrom!.name })}</span>
          )}
        </button>
        {!readOnly && (
          <span className="flex shrink-0 gap-1.5">
            {!isExtra && (
              <button
                onClick={() => setReplacing(true)}
                aria-label={t('workout.replaceAria', { name: exercise.name })}
                title={t('workout.replaceAria', { name: exercise.name })}
                className={iconBtn}
              >
                <SwapIcon />
              </button>
            )}
            <button
              onClick={() => {
                if (isExtra) {
                  setConfirmingRemove(true)
                } else {
                  skipMutation.mutate()
                }
              }}
              disabled={skipMutation.isPending || removeExtraMutation.isPending}
              aria-label={t('workout.skipAria', { name: exercise.name })}
              title={t('workout.skipAria', { name: exercise.name })}
              className={`${iconBtn} hover:text-clay-500 dark:hover:text-clay-300`}
            >
              <CrossIcon />
            </button>
            {confirmingRemove && (
              <ConfirmDialog
                title={t('workout.skipAria', { name: exercise.name })}
                message={t('workout.removeExtraConfirm')}
                confirmLabel={t('common:delete')}
                danger
                busy={removeExtraMutation.isPending}
                onConfirm={() => removeExtraMutation.mutate()}
                onCancel={() => setConfirmingRemove(false)}
              />
            )}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-xs ${muted}`}>{prescription}</p>
      {(recordLine || lastLine) && (
        <p className={`mt-0.5 text-xs ${muted}`}>
          {[recordLine, lastLine].filter(Boolean).join(' · ')}
        </p>
      )}
      {nextWeight != null && (
        <p className="mt-1 inline-block rounded-full bg-pine-100 px-2.5 py-0.5 text-xs font-medium text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          {t('workout.progressHint', { weight: nextWeight })}
        </p>
      )}

      {skipMutation.error instanceof ApiError && (
        <p role="alert" className="mt-1 text-xs text-clay-500 dark:text-clay-300">
          {t('workout.adjustFailed')}
        </p>
      )}

      {restLeft != null && (
        <RestTimer
          secondsLeft={restLeft}
          onExtend={() => setRestLeft(restLeft + 30)}
          onSkip={() => setRestLeft(null)}
        />
      )}

      <div className="mt-2 space-y-1.5">
        {Array.from({ length: rows }, (_, i) => i + 1).map((setNumber) => (
          <SetRow
            key={`${exercise.id}-${setNumber}`}
            workoutId={workoutId}
            block={block}
            exercise={exercise}
            setNumber={setNumber}
            logged={loggedSets.find(
              (s) => s.exerciseId === exercise.id && s.setNumber === setNumber,
            )}
            readOnly={readOnly}
            onSaved={() => {
              if (block.restSec != null && setNumber < rows) setRestLeft(block.restSec)
            }}
          />
        ))}
      </div>
      {!readOnly && <SetsStepper block={block} workoutId={workoutId} />}

      {replacing && block.templateExerciseId != null && (
        <ReplaceModal workoutId={workoutId} block={block} onClose={() => setReplacing(false)} />
      )}
      {detailOpen && <ExerciseDetailSheet exercise={exercise} onClose={() => setDetailOpen(false)} />}
    </div>
  )
}

/* ── Circuit mode: the exercises, then one card per loop ────────────── */

function CircuitView({
  workoutId,
  detail,
  readOnly,
}: {
  workoutId: string
  detail: WorkoutDetailResponse
  readOnly: boolean
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const [replacing, setReplacing] = useState<WorkoutBlockResponse | null>(null)
  const [detailOf, setDetailOf] = useState<ExerciseResponse | null>(null)
  const { restLeft, setRestLeft } = useRestCountdown()

  const blocks = detail.blocks.filter((b) => b.templateExerciseId != null)
  const active = blocks.filter((b) => !b.skipped)
  const loops = Math.max(
    detail.circuitLoops ?? 1,
    ...active.map((b) => totalRows(b, detail.log.sets)),
  )
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })

  const skipMutation = useMutation({
    mutationFn: (templateExerciseId: string) => skipWorkoutBlock(workoutId, templateExerciseId),
    onSuccess: invalidate,
  })
  const restoreMutation = useMutation({
    mutationFn: (templateExerciseId: string) => restoreWorkoutBlock(workoutId, templateExerciseId),
    onSuccess: invalidate,
  })

  return (
    <>
      {/* the circuit's exercise list — details, swaps and skips live here */}
      <div className="rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
        <p className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>
          {t('workout.circuitExercises')}
        </p>
        <div className="mt-1.5 space-y-1">
          {blocks.map((block) => (
            <div key={block.templateExerciseId} className="flex items-center gap-1.5">
              <button
                onClick={() => setDetailOf(block.exercise)}
                className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-sm transition hover:bg-moss-100 dark:hover:bg-moss-800 ${block.skipped ? `line-through ${muted}` : ''}`}
                aria-label={t('workout.detailsAria', { name: block.exercise.name })}
              >
                <span className="font-medium">{block.exercise.name}</span>
                <span className={`ml-1.5 text-xs ${muted}`}>
                  {block.exercise.measure === 'SECONDS'
                    ? `${block.targetSeconds ?? '?'} sec`
                    : `× ${block.targetReps ?? '?'}`}
                </span>
              </button>
              {!readOnly && !block.skipped && (
                <>
                  <button
                    onClick={() => setReplacing(block)}
                    aria-label={t('workout.replaceAria', { name: block.exercise.name })}
                    className={iconBtn}
                  >
                    <SwapIcon />
                  </button>
                  <button
                    onClick={() => skipMutation.mutate(block.templateExerciseId!)}
                    disabled={skipMutation.isPending}
                    aria-label={t('workout.skipAria', { name: block.exercise.name })}
                    className={`${iconBtn} hover:text-clay-500 dark:hover:text-clay-300`}
                  >
                    <CrossIcon />
                  </button>
                </>
              )}
              {!readOnly && block.skipped && (
                <button
                  onClick={() => restoreMutation.mutate(block.templateExerciseId!)}
                  disabled={restoreMutation.isPending}
                  className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-pine-700 transition hover:bg-pine-100 disabled:opacity-50 dark:text-pine-300 dark:hover:bg-pine-900"
                >
                  {t('workout.restoreBlock')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {restLeft != null && (
        <RestTimer
          secondsLeft={restLeft}
          onExtend={() => setRestLeft(restLeft + 30)}
          onSkip={() => setRestLeft(null)}
        />
      )}

      {Array.from({ length: loops }, (_, i) => i + 1).map((loop) => {
        const rows = active.filter((b) => loop <= totalRows(b, detail.log.sets))
        if (rows.length === 0) return null
        return (
          <div
            key={loop}
            className="rounded-xl border border-l-4 border-moss-200 border-l-teal-600 bg-moss-25 p-3 dark:border-moss-750 dark:border-l-teal-300 dark:bg-moss-850"
          >
            <p className="text-sm font-semibold">{t('workout.loop', { n: loop, total: loops })}</p>
            <div className="mt-2 space-y-1.5">
              {rows.map((block, index) => (
                <SetRow
                  key={`${block.exercise.id}-${loop}`}
                  workoutId={workoutId}
                  block={block}
                  exercise={block.exercise}
                  setNumber={loop}
                  label={block.exercise.name}
                  logged={detail.log.sets.find(
                    (s) => s.exerciseId === block.exercise.id && s.setNumber === loop,
                  )}
                  readOnly={readOnly}
                  onSaved={() => {
                    if (detail.circuitRestSec != null && detail.circuitRestSec > 0
                        && index === rows.length - 1 && loop < loops) {
                      setRestLeft(detail.circuitRestSec)
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )
      })}

      {replacing?.templateExerciseId != null && (
        <ReplaceModal workoutId={workoutId} block={replacing} onClose={() => setReplacing(null)} />
      )}
      {detailOf && <ExerciseDetailSheet exercise={detailOf} onClose={() => setDetailOf(null)} />}
    </>
  )
}

/* ── One set row: inputs prefilled with last time, one tap to save ──── */

function SetRow({
  workoutId,
  block,
  exercise,
  setNumber,
  label,
  logged,
  readOnly,
  onSaved,
}: {
  workoutId: string
  block: WorkoutBlockResponse
  exercise: ExerciseResponse
  setNumber: number
  label?: string
  logged: SetLogResponse | undefined
  readOnly: boolean
  onSaved: () => void
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  // Saved = the server has it: the tick reflects detail.log.sets, so a
  // second tap can honestly undo (delete) a set logged by mistake.
  const saved = logged != null

  const seconds = exercise.measure === 'SECONDS'
  const bodyweight = exercise.measure === 'BODYWEIGHT_REPS'
  // prefill: what I did on this set LAST time, else the prescription target
  const lastSame = block.lastSets.find((s) => s.setNumber === setNumber)

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })

  const mutation = useMutation({
    mutationFn: () =>
      logSet(workoutId, {
        exerciseId: exercise.id,
        position: 0,
        setNumber,
        reps: seconds ? undefined : Number(repsRef.current?.value) || undefined,
        weightKg: seconds
          ? undefined
          : weightRef.current?.value
            ? Number(weightRef.current.value)
            : undefined,
        seconds: seconds ? Number(secondsRef.current?.value) || undefined : undefined,
      }),
    onSuccess: () => {
      onSaved()
      // Refresh the workout so detail.log.sets (loggedSets) reflects this save.
      invalidate()
    },
  })
  const unsaveMutation = useMutation({
    mutationFn: () => deleteSet(logged!.id),
    onSuccess: invalidate,
  })

  return (
    <div className="flex items-center gap-2">
      {label != null ? (
        <span className="w-24 shrink-0 truncate text-xs font-medium">{label}</span>
      ) : (
        <span className={`w-5 shrink-0 text-center text-xs font-semibold ${muted}`}>{setNumber}</span>
      )}
      {seconds ? (
        <div className="flex-1">
          <input
            ref={secondsRef}
            type="number"
            inputMode="numeric"
            min={1}
            aria-label={t('workout.setSecondsAria', { n: setNumber })}
            defaultValue={logged?.seconds ?? lastSame?.seconds ?? block.targetSeconds ?? ''}
            className={inputCls}
            disabled={readOnly}
          />
        </div>
      ) : (
        <>
          <div className="flex-1">
            <input
              ref={weightRef}
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              aria-label={t('workout.setWeightAria', { n: setNumber })}
              placeholder={bodyweight ? t('workout.bodyweight') : 'kg'}
              defaultValue={logged?.weightKg ?? lastSame?.weightKg ?? ''}
              className={inputCls}
              disabled={readOnly}
            />
          </div>
          <span className={`text-xs ${muted}`}>kg ×</span>
          <div className="w-16 shrink-0">
            <input
              ref={repsRef}
              type="number"
              inputMode="numeric"
              min={1}
              aria-label={t('workout.setRepsAria', { n: setNumber })}
              defaultValue={logged?.reps ?? lastSame?.reps ?? block.targetReps ?? ''}
              className={inputCls}
              disabled={readOnly}
            />
          </div>
        </>
      )}
      {!readOnly && (
        <button
          onClick={() => (saved ? unsaveMutation.mutate() : mutation.mutate())}
          disabled={mutation.isPending || unsaveMutation.isPending}
          aria-label={saved
            ? t('workout.unsaveSetAria', { n: setNumber })
            : t('workout.saveSetAria', { n: setNumber })}
          aria-pressed={saved}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-semibold transition disabled:opacity-50 ${
            saved
              ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
              : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
          }`}
        >
          ✓
        </button>
      )}
      {(mutation.error ?? unsaveMutation.error) instanceof ApiError && (
        <span role="alert" className="text-xs text-clay-500 dark:text-clay-300">
          {t('workout.saveFailed')}
        </span>
      )}
    </div>
  )
}

/* ── Add an exercise mid-workout (this session only) ───────────────── */

function AddExerciseModal({
  workoutId,
  blocks,
  onClose,
}: {
  workoutId: string
  blocks: WorkoutBlockResponse[]
  onClose: () => void
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const [exerciseId, setExerciseId] = useState('')

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: fetchExercises,
  })
  // an exercise already on screen (prescribed, swapped-in or added) can't be added twice
  const taken = new Set(
    blocks.flatMap((b) => [b.exercise.id, b.swappedFrom?.id]).filter(Boolean) as string[],
  )
  const candidates = (exercisesQuery.data ?? []).filter((e) => !e.archived && !taken.has(e.id))
  const chosen = candidates.find((e) => e.id === exerciseId)
  const seconds = chosen?.measure === 'SECONDS'

  const mutation = useMutation({
    mutationFn: (body: { sets: number; reps?: number; seconds?: number; restSec?: number }) =>
      addExtraBlock(workoutId, { exerciseId, ...body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })
      onClose()
    },
  })

  return (
    <Modal title={t('workout.addExerciseTitle')} onClose={onClose}>
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!exerciseId) return
          const data = new FormData(event.currentTarget)
          mutation.mutate({
            sets: Number(data.get('sets')) || 3,
            reps: seconds ? undefined : Number(data.get('reps')) || undefined,
            seconds: seconds ? Number(data.get('seconds')) || undefined : undefined,
            restSec: Number(data.get('restSec')) || undefined,
          })
        }}
      >
        <select
          value={exerciseId}
          onChange={(event) => setExerciseId(event.target.value)}
          aria-label={t('workout.exerciseLabel')}
          className={`${inputCls} text-left font-normal`}
        >
          <option value="">{t('workout.pickExercise')}</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {chosen && (
          <div className="flex gap-2">
            <label className="flex-1 text-xs font-medium">
              {t('workout.setsLabel')}
              <input name="sets" type="number" inputMode="numeric" min={1} defaultValue={3}
                className={`${inputCls} mt-1`} />
            </label>
            {seconds ? (
              <label className="flex-1 text-xs font-medium">
                {t('workout.secondsLabel')}
                <input name="seconds" type="number" inputMode="numeric" min={1} defaultValue={30}
                  className={`${inputCls} mt-1`} />
              </label>
            ) : (
              <label className="flex-1 text-xs font-medium">
                {t('workout.repsLabel')}
                <input name="reps" type="number" inputMode="numeric" min={1} defaultValue={10}
                  className={`${inputCls} mt-1`} />
              </label>
            )}
            <label className="flex-1 text-xs font-medium">
              {t('workout.restLabel')}
              <input name="restSec" type="number" inputMode="numeric" min={0} step={15}
                className={`${inputCls} mt-1`} />
            </label>
          </div>
        )}
        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-xs text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!chosen || mutation.isPending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {t('workout.addBlock')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`px-2 py-1.5 text-sm font-medium ${muted}`}
          >
            {t('common:cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Finish: duration, effort, pain, comment ───────────────────────── */

function FinishPanel({
  detail,
  onDone,
  onCancel,
}: {
  detail: WorkoutDetailResponse
  onDone: (sessionId: string | null) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('gym')
  const elapsedMin = Math.max(
    1,
    Math.round((Date.now() - new Date(detail.log.startedAt).getTime()) / 60000),
  )
  const [effort, setEffort] = useState<PerceivedEffort>('COMME_PREVU')
  const [pain, setPain] = useState(false)

  const mutation = useMutation({
    mutationFn: (body: { durationMin: number; comment?: string }) =>
      finishWorkout(detail.log.id, { ...body, perceivedEffort: effort, painFlag: pain }),
    onSuccess: () => onDone(detail.log.sessionId),
  })

  return (
    <Modal title={t('workout.finishTitle')} onClose={onCancel}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          mutation.mutate({
            durationMin: Number(data.get('durationMin')) || elapsedMin,
            comment: ((data.get('comment') as string) || '').trim() || undefined,
          })
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">{t('workout.totalDuration')}</span>
          <input
            name="durationMin"
            type="number"
            min={1}
            defaultValue={elapsedMin}
            className={`${inputCls} mt-1 max-w-32 text-left`}
          />
        </label>
        <div>
          <span className="text-sm font-medium">{t('workout.howWasIt')}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEffort(e)}
                aria-pressed={effort === e}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  effort === e
                    ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                    : 'bg-moss-100 text-moss-500 hover:text-ink dark:bg-moss-800 dark:text-moss-400 dark:hover:text-linen'
                }`}
              >
                {t(`workout.effort.${e}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pain}
            onChange={(event) => setPain(event.target.checked)}
            className="h-4 w-4 accent-clay-500"
          />
          {t('workout.pain')}
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('workout.commentLabel')}</span>
          <textarea name="comment" rows={2} className={`${inputCls} mt-1 text-left font-normal`} />
        </label>
        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {mutation.isPending ? t('common:saving') : t('workout.saveWorkout')}
          </button>
          <button type="button" onClick={onCancel} className={`px-3 py-2 text-sm font-medium ${muted}`}>
            {t('workout.continueWorkout')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
