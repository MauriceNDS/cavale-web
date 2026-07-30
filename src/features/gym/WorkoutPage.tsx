import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, Delete, Link2, List, Timer, Unlink2, X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { layer, muted } from '../../lib/ui'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import {
  abandonWorkout,
  addExtraBlock,
  fetchExercises,
  fetchWorkout,
  finishWorkout,
  regroupWorkout,
  swapWorkoutBlock,
  type ExerciseResponse,
  type PerceivedEffort,
  type SetLogResponse,
  type WorkoutBlockResponse,
  type WorkoutDetailResponse,
  type WorkoutRecapResponse,
} from './api'
import { gymQueue, type QueueState } from './mutationQueue'
import { RestBar, RirChips, useOwnsRestBar, useWakeLock } from './RestBar'
import { restClock } from './restClock'
import {
  blockId,
  blocksInRound,
  buildSteps,
  firstUnfinished,
  restAfter,
  resumeRound,
  roundComplete,
  setKey,
  stepComplete,
  totalRows,
  type Step,
} from './workoutModel'
import { CATEGORY_BADGE, categoryLabel, muscleLabel } from './labels'

/** 44px targets — mid-workout taps are made with shaky, chalky thumbs. */
const tapBtn =
  'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-moss-200 text-moss-500 transition active:scale-95 hover:bg-moss-100 hover:text-ink disabled:opacity-40 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen'

const EFFORTS: PerceivedEffort[] = [
  'TROP_FACILE', 'FACILE', 'COMME_PREVU', 'DIFFICILE', 'TROP_DIFFICILE',
]

/**
 * Relative-effort points per minute by how the session felt — the same
 * table the server uses, mirrored here only to preview the load while the
 * chips are being tapped. The server's answer is the one that counts.
 */
const EFFORT_RATE: Record<PerceivedEffort, number> = {
  TROP_FACILE: 0.4,
  FACILE: 0.55,
  COMME_PREVU: 0.7,
  DIFFICILE: 0.85,
  TROP_DIFFICILE: 1.0,
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

/** Trailing zeros are noise on a plate: 82.5 kg, but 80 kg. */
function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

/* ── The values being entered for one set ──────────────────────────── */

interface Draft {
  weightKg?: number
  reps?: number
  seconds?: number
  warmup?: boolean
}

/* ══════════════════════════════════════════════════════════════════════
   The live workout: one thing at a time, every tap saved locally first.
   ══════════════════════════════════════════════════════════════════════ */

export function WorkoutPage() {
  const { t } = useTranslation('gym')
  const params = useParams({ strict: false }) as { workoutId?: string }
  const workoutId = params.workoutId!
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => fetchWorkout(workoutId),
    // the cache is the source of truth mid-workout: refetching would undo
    // optimistic ticks that are still queued
    refetchOnWindowFocus: false,
  })
  const detail = query.data

  const finished = detail?.log.status === 'FINISHED'
  useWakeLock(detail != null && !finished)
  useOwnsRestBar()

  const [mode, setMode] = useState<'focus' | 'list'>('focus')
  const [stepIndex, setStepIndex] = useState(0)
  const [round, setRound] = useState(1)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [ratingSetId, setRatingSetId] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [recap, setRecap] = useState<WorkoutRecapResponse | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  const [placed, setPlaced] = useState(false)

  const steps = useMemo(() => (detail ? buildSteps(detail) : []), [detail])

  // land where the session actually is, once, on first load
  useEffect(() => {
    if (placed || !detail || steps.length === 0) return
    const at = firstUnfinished(steps, detail.log.sets)
    setStepIndex(at.stepIndex)
    setRound(at.round)
    setPlaced(true)
  }, [placed, detail, steps])

  /** Patch the cached workout in place — no round trip, no flicker. */
  const patch = useCallback(
    (update: (current: WorkoutDetailResponse) => WorkoutDetailResponse) => {
      queryClient.setQueryData<WorkoutDetailResponse>(['workout', workoutId], (current) =>
        current ? update(current) : current,
      )
    },
    [queryClient, workoutId],
  )

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!detail) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('workout.notFound')}</p>
    )
  }

  const step = steps[Math.min(stepIndex, steps.length - 1)]

  /* ── Logging a set: local first, network whenever it can ──────────── */

  function logSet(block: WorkoutBlockResponse, setNumber: number, draft: Draft) {
    const seconds = block.exercise.measure === 'SECONDS'
    const body = {
      exerciseId: block.exercise.id,
      position: 0,
      setNumber,
      reps: seconds ? undefined : draft.reps,
      weightKg: seconds ? undefined : draft.weightKg,
      seconds: seconds ? draft.seconds : undefined,
      warmup: draft.warmup ?? false,
    }
    const key = setKey(block.exercise.id, setNumber)
    const localId = `local:${key}`

    patch((current) => {
      const others = current.log.sets.filter(
        (s) => !(s.exerciseId === block.exercise.id && s.setNumber === setNumber),
      )
      const existing = current.log.sets.find(
        (s) => s.exerciseId === block.exercise.id && s.setNumber === setNumber,
      )
      const logged: SetLogResponse = {
        id: existing?.id ?? localId,
        exerciseId: block.exercise.id,
        exerciseName: block.exercise.name,
        position: 0,
        setNumber,
        reps: body.reps ?? null,
        weightKg: body.weightKg ?? null,
        seconds: body.seconds ?? null,
        warmup: body.warmup,
        rir: existing?.rir ?? null,
      }
      return { ...current, log: { ...current.log, sets: [...others, logged] } }
    })

    gymQueue.push({
      key: `set:${workoutId}:${key}`,
      method: 'PUT',
      path: `/api/workouts/${workoutId}/sets`,
      body,
    })

    // rest is dead time — that is where the rating question goes
    setRatingSetId(localId)
    const owed = restAfter(step, block, setNumber, detail!.log.sets)
    if (owed != null && owed > 0) restClock.start(owed)
  }

  function unlogSet(block: WorkoutBlockResponse, setNumber: number) {
    const key = setKey(block.exercise.id, setNumber)
    const logged = detail!.log.sets.find(
      (s) => s.exerciseId === block.exercise.id && s.setNumber === setNumber,
    )
    patch((current) => ({
      ...current,
      log: {
        ...current.log,
        sets: current.log.sets.filter(
          (s) => !(s.exerciseId === block.exercise.id && s.setNumber === setNumber),
        ),
      },
    }))
    const wasStillQueued = gymQueue.cancel(`set:${workoutId}:${key}`)
    // if the write never left, the server never knew: nothing to delete
    if (!wasStillQueued && logged && !logged.id.startsWith('local:')) {
      gymQueue.push({
        key: `unset:${workoutId}:${key}`,
        method: 'DELETE',
        path: `/api/workouts/sets/${logged.id}`,
      })
    }
    setRatingSetId(null)
  }

  function rateSet(setId: string, rir: number) {
    patch((current) => ({
      ...current,
      log: {
        ...current.log,
        sets: current.log.sets.map((s) => (s.id === setId ? { ...s, rir } : s)),
      },
    }))
    if (setId.startsWith('local:')) {
      // the set itself hasn't reached the server yet; fold the rating into
      // the pending write rather than racing it
      const key = setId.slice('local:'.length)
      const [exerciseId, setNumber] = key.split(':')
      const logged = detail!.log.sets.find(
        (s) => s.exerciseId === exerciseId && s.setNumber === Number(setNumber),
      )
      const block = detail!.blocks.find((b) => b.exercise.id === exerciseId)
      if (logged && block) {
        const seconds = block.exercise.measure === 'SECONDS'
        gymQueue.push({
          key: `set:${workoutId}:${key}`,
          method: 'PUT',
          path: `/api/workouts/${workoutId}/sets`,
          body: {
            exerciseId,
            position: 0,
            setNumber: Number(setNumber),
            reps: seconds ? undefined : logged.reps ?? undefined,
            weightKg: seconds ? undefined : logged.weightKg ?? undefined,
            seconds: seconds ? logged.seconds ?? undefined : undefined,
            warmup: logged.warmup,
            rir,
          },
        })
      }
      return
    }
    gymQueue.push({
      key: `rating:${setId}`,
      method: 'PATCH',
      path: `/api/workouts/sets/${setId}/rating`,
      body: { rir },
    })
  }

  function adjustSets(block: WorkoutBlockResponse, sets: number) {
    if (sets < 0 || sets > 10) return
    const id = blockId(block)
    patch((current) => ({
      ...current,
      blocks: current.blocks.map((b) => (blockId(b) === id ? { ...b, sets } : b)),
    }))
    gymQueue.push({
      key: `sets:${workoutId}:${id}`,
      method: 'PUT',
      path: block.templateExerciseId != null
        ? `/api/workouts/${workoutId}/blocks/${block.templateExerciseId}/sets`
        : `/api/workouts/${workoutId}/extra-blocks/${block.extraBlockId}/sets`,
      body: { sets },
    })
  }

  function toggleSkip(block: WorkoutBlockResponse) {
    if (block.templateExerciseId == null) return
    const id = block.templateExerciseId
    const skipped = !block.skipped
    patch((current) => ({
      ...current,
      blocks: current.blocks.map((b) => (b.templateExerciseId === id ? { ...b, skipped } : b)),
    }))
    gymQueue.push({
      key: `skip:${workoutId}:${id}`,
      method: 'POST',
      path: `/api/workouts/${workoutId}/blocks/${id}/${skipped ? 'skip' : 'restore'}`,
    })
  }

  const draftFor = (block: WorkoutBlockResponse, setNumber: number): Draft => {
    const key = setKey(block.exercise.id, setNumber)
    if (drafts[key]) return drafts[key]
    const logged = detail.log.sets.find(
      (s) => s.exerciseId === block.exercise.id && s.setNumber === setNumber,
    )
    if (logged) {
      return {
        weightKg: logged.weightKg ?? undefined,
        reps: logged.reps ?? undefined,
        seconds: logged.seconds ?? undefined,
        warmup: logged.warmup,
      }
    }
    const lastSame = block.lastSets.find((s) => s.setNumber === setNumber)
    return {
      weightKg: block.suggestedWeightKg ?? lastSame?.weightKg ?? undefined,
      reps: block.targetReps ?? lastSame?.reps ?? undefined,
      seconds: block.targetSeconds ?? lastSame?.seconds ?? undefined,
      warmup: false,
    }
  }

  const setDraft = (block: WorkoutBlockResponse, setNumber: number, patchDraft: Draft) => {
    const key = setKey(block.exercise.id, setNumber)
    setDrafts((current) => ({ ...current, [key]: { ...draftFor(block, setNumber), ...patchDraft } }))
  }

  /** Stay on this exercise, change set. */
  function goToRound(nextRound: number) {
    setRound(Math.max(1, Math.min(step?.rounds ?? 1, nextRound)))
  }

  /**
   * Change exercise, landing on the set that exercise actually owes. Every
   * way into another exercise — the strip, the list, the arrows — goes
   * through here, so leaving one mid-way and coming back always resumes.
   */
  function jumpTo(nextStep: number) {
    const index = Math.max(0, Math.min(steps.length - 1, nextStep))
    const target = steps[index]
    if (!target) return
    setStepIndex(index)
    setRound(resumeRound(target, detail!.log.sets))
    setMode('focus')
  }

  /** Advance past the round that was just completed. */
  function advance() {
    if (!step) return
    if (round < step.rounds) setRound(round + 1)
    else if (stepIndex < steps.length - 1) jumpTo(stepIndex + 1)
  }

  return (
    <div
      className="mx-auto mt-3 max-w-2xl pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-28"
      onPointerDownCapture={() => restClock.unlockSound()}
    >
      <WorkoutHeader
        detail={detail}
        finished={finished}
        mode={mode}
        onToggleMode={() => setMode(mode === 'focus' ? 'list' : 'focus')}
        onFinish={() => setFinishing(true)}
      />

      {finished && (
        <p className="mt-3 rounded-lg bg-pine-100 p-3 text-sm font-medium text-pine-700 dark:bg-pine-900 dark:text-pine-300">
          {t('workout.finishedIn', { min: detail.log.durationMin })}{' '}
          {detail.log.sessionId && (
            <Link to="/session/$sessionId" params={{ sessionId: detail.log.sessionId }}
              className="underline">
              {t('workout.viewSession')}
            </Link>
          )}
        </p>
      )}

      {steps.length === 0 && (
        <p className={`mt-8 text-center text-sm ${muted}`}>{t('workout.templateGone')}</p>
      )}

      {mode === 'focus' && step && (
        <FocusStep
          detail={detail}
          steps={steps}
          step={step}
          stepIndex={stepIndex}
          round={round}
          readOnly={finished}
          draftFor={draftFor}
          onDraft={setDraft}
          onLog={(block, setNumber, draft) => logSet(block, setNumber, draft)}
          onUnlog={unlogSet}
          onAdjustSets={adjustSets}
          onToggleSkip={toggleSkip}
          onAdvance={advance}
          onJumpTo={jumpTo}
          onGoToRound={goToRound}
        />
      )}

      {mode === 'list' && (
        <StepList
          detail={detail}
          steps={steps}
          activeStep={stepIndex}
          readOnly={finished}
          onPick={jumpTo}
          onToggleSkip={toggleSkip}
          onRegrouped={() => void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })}
          workoutId={workoutId}
          onAddExercise={() => setAddingExercise(true)}
        />
      )}

      <RunnerRestBar
        ratingSet={detail.log.sets.find((s) => s.id === ratingSetId) ?? null}
        onRate={(rir) => {
          if (ratingSetId) rateSet(ratingSetId, rir)
        }}
      />

      {addingExercise && !finished && (
        <AddExerciseModal
          workoutId={workoutId}
          blocks={detail.blocks}
          onClose={() => setAddingExercise(false)}
        />
      )}

      {finishing && !finished && !recap && (
        <FinishPanel
          detail={detail}
          onDone={(result) => {
            restClock.skip()
            setFinishing(false)
            setRecap(result)
            void queryClient.invalidateQueries()
          }}
          onCancel={() => setFinishing(false)}
        />
      )}

      {recap && (
        <RecapPanel
          recap={recap}
          onClose={() => {
            void navigate(recap.sessionId
              ? { to: '/session/$sessionId', params: { sessionId: recap.sessionId } }
              : { to: '/renfo' })
          }}
        />
      )}
    </div>
  )
}

/* ── Header: elapsed, sync state, view switch, finish ──────────────── */

function WorkoutHeader({
  detail,
  finished,
  mode,
  onToggleMode,
  onFinish,
}: {
  detail: WorkoutDetailResponse
  finished: boolean
  mode: 'focus' | 'list'
  onToggleMode: () => void
  onFinish: () => void
}) {
  const { t } = useTranslation('gym')
  const [, tick] = useState(0)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [finished])

  const abandonMutation = useMutation({
    mutationFn: () => abandonWorkout(detail.log.id),
    onSuccess: () => void navigate({ to: '/renfo' }),
  })

  return (
    <div className={`sticky top-0 ${layer.sticky} -mx-4 border-b border-moss-200 bg-moss-50/95 px-4 py-2.5 backdrop-blur md:mx-0 md:rounded-xl md:border dark:border-moss-750 dark:bg-moss-900/95`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold">
            {detail.log.templateName ?? t('workout.untitled')}
          </p>
          <p className={`flex items-center gap-2 text-xs tabular-nums ${muted}`}>
            {!finished && (
              <span className="inline-flex items-center gap-1">
                <Timer size={12} aria-hidden />
                {formatElapsed(detail.log.startedAt)}
              </span>
            )}
            <SyncChip />
          </p>
        </div>
        {!finished && (
          <>
            <button
              onClick={onToggleMode}
              aria-label={t(mode === 'focus' ? 'workout.showList' : 'workout.showFocus')}
              title={t(mode === 'focus' ? 'workout.showList' : 'workout.showFocus')}
              className={tapBtn}
            >
              {mode === 'focus' ? <List size={18} aria-hidden /> : <ChevronLeft size={18} aria-hidden />}
            </button>
            <button
              onClick={() => setConfirmingAbandon(true)}
              aria-label={t('workout.abandon')}
              title={t('workout.abandon')}
              className={`${tapBtn} hover:text-clay-500 dark:hover:text-clay-300`}
            >
              <X size={18} aria-hidden />
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
              className="rounded-xl bg-pine-600 px-3.5 py-2.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {t('workout.finish')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Only speaks up when there is something to say. */
function SyncChip() {
  const { t } = useTranslation('gym')
  const [state, setState] = useState<QueueState>(() => gymQueue.state())
  useEffect(() => gymQueue.subscribe(setState), [])

  if (state.lastError) {
    return (
      <span role="alert" className="rounded-full bg-clay-100 px-2 py-0.5 text-[11px] font-medium text-clay-500 dark:bg-clay-900 dark:text-clay-300">
        {t('workout.syncFailed')}
      </span>
    )
  }
  if (state.pending === 0) return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
      state.online
        ? 'bg-moss-100 text-moss-500 dark:bg-moss-800 dark:text-moss-400'
        : 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300'
    }`}>
      {state.online
        ? t('workout.syncing', { count: state.pending })
        : t('workout.offlinePending', { count: state.pending })}
    </span>
  )
}

/* ── The runner: one exercise (or one superset) at a time ──────────── */

function FocusStep({
  detail,
  steps,
  step,
  stepIndex,
  round,
  readOnly,
  draftFor,
  onDraft,
  onLog,
  onUnlog,
  onAdjustSets,
  onToggleSkip,
  onAdvance,
  onJumpTo,
  onGoToRound,
}: {
  detail: WorkoutDetailResponse
  steps: Step[]
  step: Step
  stepIndex: number
  round: number
  readOnly: boolean
  draftFor: (block: WorkoutBlockResponse, setNumber: number) => Draft
  onDraft: (block: WorkoutBlockResponse, setNumber: number, draft: Draft) => void
  onLog: (block: WorkoutBlockResponse, setNumber: number, draft: Draft) => void
  onUnlog: (block: WorkoutBlockResponse, setNumber: number) => void
  onAdjustSets: (block: WorkoutBlockResponse, sets: number) => void
  onToggleSkip: (block: WorkoutBlockResponse) => void
  onAdvance: () => void
  onJumpTo: (stepIndex: number) => void
  onGoToRound: (round: number) => void
}) {
  const { t } = useTranslation('gym')
  const [detailOf, setDetailOf] = useState<ExerciseResponse | null>(null)
  const [replacing, setReplacing] = useState<WorkoutBlockResponse | null>(null)

  const due = blocksInRound(step, round, detail.log.sets)
  const superset = step.blocks.length > 1
  const nextStep = steps[stepIndex + 1]

  const roundDone = roundComplete(step, round, detail.log.sets)

  return (
    <>
      {/* the map, compressed to a strip: where am I, and how much is left.
          Each bar is a jump to that exercise — a hairline is impossible to
          hit, so the tap target is the padding around it. */}
      <div className="mt-1 flex items-stretch gap-1.5">
        {steps.map((s, i) => {
          const done = stepComplete(s, detail.log.sets)
          return (
            <button
              key={s.id}
              onClick={() => onJumpTo(i)}
              aria-label={t('workout.goToStep', { name: s.blocks[0].exercise.name })}
              aria-current={i === stepIndex}
              className="group flex-1 py-2.5"
            >
              <span
                className={`block h-1.5 rounded-full transition group-active:scale-y-150 ${
                  i === stepIndex
                    ? 'bg-copper-600 dark:bg-copper-300'
                    : done
                      ? 'bg-pine-600 dark:bg-pine-350'
                      : 'bg-moss-200 dark:bg-moss-750'
                }`}
              />
            </button>
          )
        })}
      </div>
      <p className={`text-center text-xs ${muted}`}>
        {t('workout.stepOf', { current: stepIndex + 1, total: steps.length })}
      </p>

      <div className="mt-2 rounded-2xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850">
        {superset && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-teal-600/15 px-2.5 py-1 text-xs font-semibold text-teal-600 dark:bg-teal-300/15 dark:text-teal-300">
            <Link2 size={13} aria-hidden />
            {t('workout.supersetRound', { key: step.groupKey, round, total: step.rounds })}
          </p>
        )}

        <RoundChips
          step={step}
          round={round}
          loggedSets={detail.log.sets}
          onPick={onGoToRound}
        />

        {due.length === 0 && (
          <p className={`py-6 text-center text-sm ${muted}`}>{t('workout.roundEmpty')}</p>
        )}

        <div className="space-y-4">
          {due.map((block, i) => (
            <BlockSet
              key={blockId(block)}
              detail={detail}
              block={block}
              setNumber={round}
              label={superset ? `${step.groupKey}${i + 1}` : null}
              readOnly={readOnly}
              draft={draftFor(block, round)}
              onDraft={(d) => onDraft(block, round, d)}
              onLog={(d) => onLog(block, round, d)}
              onUnlog={() => onUnlog(block, round)}
              onOpenDetail={() => setDetailOf(block.exercise)}
              onReplace={() => setReplacing(block)}
              onSkip={() => onToggleSkip(block)}
              onAdjustSets={(sets) => onAdjustSets(block, sets)}
            />
          ))}
        </div>
      </div>

      {/* The arrows change EXERCISE, the chips above change set. Keeping the
          two axes apart is what lets you alternate two exercises without
          pairing them: ‹ and › always land on the set each one still owes. */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onJumpTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          aria-label={t('workout.previous')}
          title={steps[stepIndex - 1]?.blocks[0].exercise.name}
          className={tapBtn}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          onClick={onAdvance}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            roundDone
              ? 'bg-pine-600 text-moss-25 hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300'
              : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
          }`}
        >
          {round < step.rounds
            ? t(superset ? 'workout.nextRound' : 'workout.nextSet', { round: round + 1, n: round + 1 })
            : nextStep
              ? t('workout.nextExercise', { name: nextStep.blocks[0].exercise.name })
              : t('workout.lastStep')}
        </button>
        <button
          onClick={() => onJumpTo(stepIndex + 1)}
          disabled={stepIndex >= steps.length - 1}
          aria-label={t('workout.next')}
          title={nextStep?.blocks[0].exercise.name}
          className={tapBtn}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {detailOf && <ExerciseDetailSheet exercise={detailOf} onClose={() => setDetailOf(null)} />}
      {replacing?.templateExerciseId != null && (
        <ReplaceModal
          workoutId={detail.log.id}
          block={replacing}
          onClose={() => setReplacing(null)}
        />
      )}
    </>
  )
}

/**
 * The sets of the exercise on screen: which are banked, which one you are
 * on, and a way back to any of them — to redo a set, or to fix a number
 * fat-fingered three sets ago.
 */
function RoundChips({
  step,
  round,
  loggedSets,
  onPick,
}: {
  step: Step
  round: number
  loggedSets: SetLogResponse[]
  onPick: (round: number) => void
}) {
  const { t } = useTranslation('gym')
  if (step.rounds < 2) return null
  const superset = step.blocks.length > 1

  return (
    <div className="mb-3 flex items-center gap-1.5">
      {Array.from({ length: step.rounds }, (_, i) => i + 1).map((r) => {
        const done = roundComplete(step, r, loggedSets)
        const current = r === round
        return (
          <button
            key={r}
            onClick={() => onPick(r)}
            aria-current={current}
            aria-label={t(superset ? 'workout.goToRound' : 'workout.goToSet', { n: r })}
            className={`h-9 flex-1 rounded-lg border text-sm font-bold tabular-nums transition active:scale-95 ${
              current
                ? 'border-copper-600 bg-copper-600 text-moss-25 dark:border-copper-300 dark:bg-copper-300 dark:text-moss-950'
                : done
                  ? 'border-pine-600/40 bg-pine-100 text-pine-700 dark:border-pine-350/40 dark:bg-pine-900 dark:text-pine-300'
                  : `border-moss-200 ${muted} dark:border-moss-750`
            }`}
          >
            {done && !current ? <Check size={15} className="mx-auto" aria-hidden /> : r}
          </button>
        )
      })}
    </div>
  )
}

/* ── One block's current set: the whole point of the screen ────────── */

function BlockSet({
  detail,
  block,
  setNumber,
  label,
  readOnly,
  draft,
  onDraft,
  onLog,
  onUnlog,
  onOpenDetail,
  onReplace,
  onSkip,
  onAdjustSets,
}: {
  detail: WorkoutDetailResponse
  block: WorkoutBlockResponse
  setNumber: number
  label: string | null
  readOnly: boolean
  draft: Draft
  onDraft: (draft: Draft) => void
  onLog: (draft: Draft) => void
  onUnlog: () => void
  onOpenDetail: () => void
  onReplace: () => void
  onSkip: () => void
  onAdjustSets: (sets: number) => void
}) {
  const { t } = useTranslation('gym')
  const [keypad, setKeypad] = useState<'weight' | 'reps' | 'seconds' | null>(null)

  const seconds = block.exercise.measure === 'SECONDS'
  const logged = detail.log.sets.find(
    (s) => s.exerciseId === block.exercise.id && s.setNumber === setNumber,
  )
  const saved = logged != null
  const rows = totalRows(block, detail.log.sets)
  const step_ = block.exercise.effectiveIncrementKg || 2.5

  const target = seconds
    ? t('workout.targetSeconds', { count: block.targetSeconds ?? 0 })
    : t('workout.targetReps', { count: block.targetReps ?? 0 })

  return (
    <div>
      <div className="flex items-start gap-2">
        {label && (
          <span className="mt-0.5 shrink-0 rounded bg-teal-600/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-600 dark:bg-teal-300/15 dark:text-teal-300">
            {label}
          </span>
        )}
        <button onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <span className="block font-display text-lg leading-tight font-semibold">
            {block.exercise.name}
          </span>
          <span className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs ${muted}`}>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[block.exercise.category]}`}>
              {categoryLabel(block.exercise.category)}
            </span>
            <span>{t('workout.setOf', { current: setNumber, total: rows })}</span>
            <span>· {target}</span>
            {block.intensityPct != null && <span>· {block.intensityPct} %</span>}
          </span>
          {block.swappedFrom && (
            <span className={`block text-xs ${muted}`}>
              {t('workout.insteadOf', { name: block.swappedFrom.name })}
            </span>
          )}
        </button>
        {!readOnly && block.templateExerciseId != null && (
          <div className="flex shrink-0 gap-1">
            <button onClick={onReplace} aria-label={t('workout.replaceAria', { name: block.exercise.name })} className={tapBtn}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" />
              </svg>
            </button>
            <button onClick={onSkip} aria-label={t('workout.skipAria', { name: block.exercise.name })}
              className={`${tapBtn} hover:text-clay-500 dark:hover:text-clay-300`}>
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <SuggestionCaption block={block} />

      {/* the numbers, thumb-sized */}
      <div className="mt-2.5 space-y-2">
        {seconds ? (
          <Stepper
            label={t('workout.secondsUnit')}
            value={draft.seconds ?? block.targetSeconds ?? 30}
            step={5}
            min={1}
            disabled={readOnly}
            onChange={(seconds) => onDraft({ seconds })}
            onTap={() => setKeypad('seconds')}
          />
        ) : (
          <>
            <Stepper
              label="kg"
              value={draft.weightKg ?? 0}
              step={step_}
              min={0}
              disabled={readOnly}
              placeholder={block.exercise.measure === 'BODYWEIGHT_REPS'
                ? t('workout.bodyweight') : undefined}
              onChange={(weightKg) => onDraft({ weightKg })}
              onTap={() => setKeypad('weight')}
            />
            <Stepper
              label={t('workout.repsUnit')}
              value={draft.reps ?? block.targetReps ?? 1}
              step={1}
              min={1}
              disabled={readOnly}
              onChange={(reps) => onDraft({ reps })}
              onTap={() => setKeypad('reps')}
            />
          </>
        )}
      </div>

      {!readOnly && (
        <>
          <button
            onClick={() => (saved ? onUnlog() : onLog(draft))}
            className={`mt-2.5 w-full rounded-xl py-3.5 text-base font-bold tracking-wide transition active:scale-[0.98] ${
              saved
                ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                : 'bg-copper-600 text-moss-25 hover:bg-copper-700 dark:bg-copper-300 dark:text-moss-950'
            }`}
          >
            {saved ? (
              <span className="inline-flex items-center gap-2">
                <Check size={18} aria-hidden />
                {t('workout.logged')}
              </span>
            ) : (
              t('workout.validate')
            )}
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              onClick={() => onDraft({ warmup: !draft.warmup })}
              aria-pressed={draft.warmup ?? false}
              className={`text-xs font-medium transition ${
                draft.warmup
                  ? 'text-copper-600 dark:text-copper-300'
                  : `${muted} hover:text-ink dark:hover:text-linen`
              }`}
            >
              {draft.warmup ? t('workout.warmupOn') : t('workout.warmupOff')}
            </button>
            <span className="ml-auto flex items-center gap-1">
              <button onClick={() => onAdjustSets(block.sets - 1)} disabled={block.sets <= 1}
                aria-label={t('workout.removeSetAria')}
                className={`text-xs font-medium ${muted} disabled:opacity-30`}>
                − {t('workout.setWord')}
              </button>
              <span className={`text-xs ${muted}`}>·</span>
              <button onClick={() => onAdjustSets(block.sets + 1)} disabled={block.sets >= 10}
                aria-label={t('workout.addSetAria')}
                className={`text-xs font-medium ${muted} disabled:opacity-30`}>
                + {t('workout.setWord')}
              </button>
            </span>
          </div>
        </>
      )}

      <DoneSets block={block} detail={detail} />

      {keypad && (
        <Keypad
          title={keypad === 'weight' ? 'kg' : keypad === 'reps' ? t('workout.repsUnit') : t('workout.secondsUnit')}
          value={keypad === 'weight' ? draft.weightKg : keypad === 'reps' ? draft.reps : draft.seconds}
          decimals={keypad === 'weight'}
          onDone={(value) => {
            onDraft(keypad === 'weight' ? { weightKg: value }
              : keypad === 'reps' ? { reps: value } : { seconds: value })
            setKeypad(null)
          }}
          onClose={() => setKeypad(null)}
        />
      )}
    </div>
  )
}

/** Where the proposed load came from — never a number out of nowhere. */
function SuggestionCaption({ block }: { block: WorkoutBlockResponse }) {
  const { t } = useTranslation('gym')
  const source = block.suggestionSource
  if (block.suggestedWeightKg == null || source === 'NONE') return null

  const why =
    source === 'INTENSITY_OF_ONE_RM'
      ? t('workout.why.intensity', { pct: block.intensityPct, basis: kg(block.suggestionBasisKg ?? 0) })
      : source === 'PROGRESSED_FROM_LAST'
        ? t('workout.why.progressed', { basis: kg(block.suggestionBasisKg ?? 0) })
        : source === 'SAME_AS_LAST'
          ? t('workout.why.sameAsLast', { basis: kg(block.suggestionBasisKg ?? 0) })
          : t('workout.why.reference')

  return <p className={`mt-1 text-[11px] ${muted}`}>{why}</p>
}

/** The sets already banked for this block, tappable to review. */
function DoneSets({ block, detail }: { block: WorkoutBlockResponse; detail: WorkoutDetailResponse }) {
  const { t } = useTranslation('gym')
  const done = detail.log.sets
    .filter((s) => s.exerciseId === block.exercise.id)
    .sort((a, b) => a.setNumber - b.setNumber)
  if (done.length === 0) return null
  return (
    <p className={`mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] ${muted}`}>
      {done.map((s) => (
        <span key={s.id} className={s.warmup ? 'opacity-60' : ''}>
          {s.seconds != null
            ? t('workout.doneSeconds', { n: s.setNumber, seconds: s.seconds })
            : t('workout.doneSet', {
                n: s.setNumber,
                weight: s.weightKg != null ? kg(s.weightKg) : '—',
                reps: s.reps ?? '—',
              })}
          {s.rir != null && ` · RIR ${s.rir}`}
          {s.warmup && ` · ${t('workout.warmupShort')}`}
        </span>
      ))}
    </p>
  )
}

/* ── A number with thumb-sized handles; tap it for the pad ─────────── */

function Stepper({
  label,
  value,
  step,
  min,
  disabled,
  placeholder,
  onChange,
  onTap,
}: {
  label: string
  value: number
  step: number
  min: number
  disabled?: boolean
  placeholder?: string
  onChange: (value: number) => void
  onTap: () => void
}) {
  const round = (v: number) => Math.round(v * 100) / 100
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, round(value - step)))}
        disabled={disabled || value <= min}
        aria-label={`− ${step} ${label}`}
        className={`${tapBtn} h-12 w-14 text-xl font-semibold`}
      >
        −
      </button>
      <button
        onClick={onTap}
        disabled={disabled}
        className="flex h-12 flex-1 items-baseline justify-center gap-1.5 rounded-xl border border-moss-200 bg-moss-100 transition active:scale-95 dark:border-moss-750 dark:bg-moss-800"
      >
        <span className="font-display text-2xl font-semibold tabular-nums">
          {value > 0 || !placeholder ? kg(value) : placeholder}
        </span>
        <span className={`text-xs ${muted}`}>{label}</span>
      </button>
      <button
        onClick={() => onChange(round(value + step))}
        disabled={disabled}
        aria-label={`+ ${step} ${label}`}
        className={`${tapBtn} h-12 w-14 text-xl font-semibold`}
      >
        +
      </button>
    </div>
  )
}

/** The OS keyboard covers the row you are editing; this does not. */
function Keypad({
  title,
  value,
  decimals,
  onDone,
  onClose,
}: {
  title: string
  value: number | undefined
  decimals: boolean
  onDone: (value: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation('gym')
  const [text, setText] = useState(value != null ? kg(value) : '')
  // 'del' rather than '⌫': the app font has no backspace glyph and renders
  // a tofu box for it.
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals ? '.' : '', '0', 'del']

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-3 rounded-xl border border-moss-200 bg-moss-100 py-3 text-center font-display text-3xl font-semibold tabular-nums dark:border-moss-750 dark:bg-moss-800">
        {text || '0'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, i) =>
          key === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => {
                if (key === 'del') setText((current) => current.slice(0, -1))
                else if (key === '.' && text.includes('.')) return
                else setText((current) => (current === '0' ? key : current + key))
              }}
              aria-label={key === 'del' ? t('workout.keypadDelete') : undefined}
              className="grid place-items-center rounded-xl border border-moss-200 py-3.5 font-display text-xl font-semibold transition active:scale-95 hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800"
            >
              {key === 'del' ? <Delete size={20} aria-hidden /> : key}
            </button>
          ),
        )}
      </div>
      <button
        onClick={() => onDone(Number(text) || 0)}
        className="mt-3 w-full rounded-xl bg-pine-600 py-3 text-sm font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950"
      >
        {t('common:save')}
      </button>
    </Modal>
  )
}

/* ── The rest countdown, with the question that only the runner asks ─ */

function RunnerRestBar({
  ratingSet,
  onRate,
}: {
  ratingSet: SetLogResponse | null
  onRate: (rir: number) => void
}) {
  return (
    <RestBar owned>
      {ratingSet && !ratingSet.warmup && (
        <RirChips value={ratingSet.rir} onRate={onRate} />
      )}
    </RestBar>
  )
}

/* ── The map: everything at a glance, and where pairing happens ────── */

function StepList({
  detail,
  steps,
  activeStep,
  readOnly,
  workoutId,
  onPick,
  onToggleSkip,
  onRegrouped,
  onAddExercise,
}: {
  detail: WorkoutDetailResponse
  steps: Step[]
  activeStep: number
  readOnly: boolean
  workoutId: string
  onPick: (index: number) => void
  onToggleSkip: (block: WorkoutBlockResponse) => void
  onRegrouped: () => void
  onAddExercise: () => void
}) {
  const { t } = useTranslation('gym')
  const prescribed = detail.blocks.filter((b) => b.templateExerciseId != null)

  const regroupMutation = useMutation({
    mutationFn: (assignments: { templateExerciseId: string; groupKey: string | null }[]) =>
      regroupWorkout(workoutId, assignments),
    onSuccess: onRegrouped,
  })

  function pairWith(index: number, unpair: boolean) {
    const keys = prescribed.map((b) => b.groupKey)
    if (unpair) {
      const key = keys[index]
      const fresh = freeKey(keys)
      for (let i = index + 1; i < keys.length && keys[i] === key; i++) keys[i] = fresh
    } else {
      const here = keys[index]
      const below = keys[index + 1]
      if (here && below) {
        for (let i = 0; i < keys.length; i++) if (keys[i] === below) keys[i] = here
      } else if (here) keys[index + 1] = here
      else if (below) keys[index] = below
      else {
        const key = freeKey(keys)
        keys[index] = key
        keys[index + 1] = key
      }
    }
    regroupMutation.mutate(
      prescribed.map((b, i) => ({ templateExerciseId: b.templateExerciseId!, groupKey: keys[i] })),
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {steps.map((step, index) => {
        const doneSets = detail.log.sets.filter((s) =>
          step.blocks.some((b) => b.exercise.id === s.exerciseId),
        ).length
        const totalSets = step.blocks.reduce((sum, b) => sum + b.sets, 0)
        const complete = stepComplete(step, detail.log.sets)
        const resumesAt = resumeRound(step, detail.log.sets)
        return (
          <div
            key={step.id}
            className={`rounded-xl border p-3 transition ${
              index === activeStep
                ? 'border-copper-600 dark:border-copper-300'
                : 'border-moss-200 dark:border-moss-750'
            } ${step.groupKey ? 'ring-1 ring-teal-600/30 dark:ring-teal-300/25' : ''} bg-moss-25 dark:bg-moss-850`}
          >
            <button onClick={() => onPick(index)} className="w-full text-left">
              {step.groupKey && (
                <span className="mb-1 inline-flex items-center gap-1 rounded bg-teal-600/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-600 dark:bg-teal-300/15 dark:text-teal-300">
                  <Link2 size={11} aria-hidden />
                  {t('workout.supersetTag', { key: step.groupKey })}
                </span>
              )}
              {step.blocks.map((block) => (
                <span key={blockId(block)} className="flex items-baseline justify-between gap-2">
                  <span className={`truncate font-medium ${block.skipped ? `line-through ${muted}` : ''}`}>
                    {block.exercise.name}
                  </span>
                  <span className={`shrink-0 text-xs tabular-nums ${muted}`}>
                    {block.sets} ×{' '}
                    {block.targetSeconds != null ? `${block.targetSeconds}s` : block.targetReps ?? '?'}
                  </span>
                </span>
              ))}
              <span className={`mt-1 block text-xs ${complete ? 'text-pine-700 dark:text-pine-300' : muted}`}>
                {complete
                  ? t('workout.stepComplete')
                  : t('workout.stepProgress', { done: doneSets, total: totalSets })}
                {/* started but unfinished: say exactly where tapping lands */}
                {!complete && doneSets > 0 && ` · ${t('workout.resumesAt', { n: resumesAt })}`}
              </span>
            </button>

            {!readOnly && step.blocks[0].templateExerciseId != null && (
              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-moss-200 pt-2 dark:border-moss-750">
                <button
                  onClick={() => onToggleSkip(step.blocks[0])}
                  className={`text-xs font-medium ${muted} hover:text-clay-500 dark:hover:text-clay-300`}
                >
                  {step.blocks[0].skipped ? t('workout.restoreBlock') : t('workout.skipShort')}
                </button>
                {(() => {
                  const last = step.blocks.at(-1)!
                  const at = prescribed.findIndex((b) => blockId(b) === blockId(last))
                  const paired = step.blocks.length > 1
                  if (paired) {
                    const first = prescribed.findIndex((b) => blockId(b) === blockId(step.blocks[0]))
                    return (
                      <button
                        onClick={() => pairWith(first, true)}
                        disabled={regroupMutation.isPending}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 disabled:opacity-50 dark:text-teal-300"
                      >
                        <Unlink2 size={12} aria-hidden />
                        {t('workout.unpair')}
                      </button>
                    )
                  }
                  if (at < 0 || at >= prescribed.length - 1) return null
                  return (
                    <button
                      onClick={() => pairWith(at, false)}
                      disabled={regroupMutation.isPending}
                      className={`inline-flex items-center gap-1 text-xs font-medium ${muted} hover:text-teal-600 disabled:opacity-50 dark:hover:text-teal-300`}
                    >
                      <Link2 size={12} aria-hidden />
                      {t('workout.pairWithNext')}
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}

      {regroupMutation.error instanceof ApiError && (
        <p role="alert" className="text-xs text-clay-500 dark:text-clay-300">
          {regroupMutation.error.message}
        </p>
      )}

      {!readOnly && (
        <button
          onClick={onAddExercise}
          className={`w-full rounded-xl border border-dashed border-moss-200 px-3 py-3 text-sm font-medium ${muted} transition hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800`}
        >
          {t('workout.addExercise')}
        </button>
      )}
    </div>
  )
}

function freeKey(keys: (string | null)[]): string {
  const taken = new Set(keys.filter(Boolean))
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!taken.has(letter)) return letter
  return 'Z'
}

/* ── Replace a block's exercise (machine taken) ────────────────────── */

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
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-3 text-left transition disabled:opacity-50 ${
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

  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: fetchExercises })
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

  const field =
    'w-full rounded-lg border border-moss-200 bg-moss-100 px-2 py-2.5 text-center text-base font-semibold tabular-nums outline-none focus:border-pine-600 dark:border-moss-750 dark:bg-moss-800'

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
          className={`${field} text-left font-normal`}
        >
          <option value="">{t('workout.pickExercise')}</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        {chosen && (
          <div className="flex gap-2">
            <label className="flex-1 text-xs font-medium">
              {t('workout.setsLabel')}
              <input name="sets" type="number" inputMode="numeric" min={1} defaultValue={3} className={`${field} mt-1`} />
            </label>
            {seconds ? (
              <label className="flex-1 text-xs font-medium">
                {t('workout.secondsLabel')}
                <input name="seconds" type="number" inputMode="numeric" min={1} defaultValue={30} className={`${field} mt-1`} />
              </label>
            ) : (
              <label className="flex-1 text-xs font-medium">
                {t('workout.repsLabel')}
                <input name="reps" type="number" inputMode="numeric" min={1} defaultValue={10} className={`${field} mt-1`} />
              </label>
            )}
            <label className="flex-1 text-xs font-medium">
              {t('workout.restLabel')}
              <input name="restSec" type="number" inputMode="numeric" min={0} step={15} className={`${field} mt-1`} />
            </label>
          </div>
        )}
        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-xs text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={!chosen || mutation.isPending}
            className="rounded-lg bg-pine-600 px-4 py-2.5 text-sm font-semibold text-moss-25 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950">
            {t('workout.addBlock')}
          </button>
          <button type="button" onClick={onClose} className={`px-2 py-1.5 text-sm font-medium ${muted}`}>
            {t('common:cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── The payoff: what the session was actually worth ───────────────── */

function RecapPanel({
  recap,
  onClose,
}: {
  recap: WorkoutRecapResponse
  onClose: () => void
}) {
  const { t } = useTranslation('gym')
  const stat = (value: string, label: string) => (
    <div className="rounded-xl bg-moss-100 px-3 py-2.5 text-center dark:bg-moss-800">
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className={`text-[11px] ${muted}`}>{label}</p>
    </div>
  )

  return (
    <Modal title={t('workout.recapTitle')} subtitle={recap.templateName ?? undefined} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {stat(t('workout.recapMinutes', { min: recap.durationMin ?? 0 }), t('workout.recapDuration'))}
          {stat(String(recap.workingSets), t('workout.recapSets'))}
          {recap.tonnageKg > 0 &&
            stat(
              recap.tonnageKg >= 1000
                ? `${(Math.round(recap.tonnageKg / 100) / 10).toFixed(1)} t`
                : `${Math.round(recap.tonnageKg)} kg`,
              t('workout.recapTonnage'),
            )}
          {recap.secondsUnderTension > 0 &&
            stat(`${Math.round(recap.secondsUnderTension / 60)} min`, t('workout.recapTension'))}
        </div>

        {recap.records.length > 0 && (
          <section className="rounded-xl border border-copper-600/40 bg-copper-600/5 p-3 dark:border-copper-300/40 dark:bg-copper-300/10">
            <p className="text-xs font-bold tracking-wide text-copper-600 uppercase dark:text-copper-300">
              {t('workout.recapRecords', { count: recap.records.length })}
            </p>
            <ul className="mt-1.5 space-y-1">
              {recap.records.map((r) => (
                <li key={`${r.exerciseName}-${r.reps}`} className="text-sm">
                  <span className="font-medium">{r.exerciseName}</span>{' '}
                  <span className={muted}>× {r.reps}</span>{' '}
                  <span className="font-semibold text-copper-600 dark:text-copper-300">
                    {kg(r.weightKg)} kg
                  </span>
                  {r.previousKg != null && (
                    <span className={`text-xs ${muted}`}> (+{kg(r.weightKg - r.previousKg)})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* a load number means nothing on its own — anchor it to a run */}
        <section className="rounded-xl bg-pine-100 p-3 dark:bg-pine-900">
          <p className="text-sm font-semibold text-pine-700 dark:text-pine-300">
            {t('workout.recapLoad', { load: recap.load })}
          </p>
          {recap.comparableRunMin != null && (
            <p className={`mt-0.5 text-xs ${muted}`}>
              {t('workout.recapComparable', { min: recap.comparableRunMin })}
            </p>
          )}
        </section>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-pine-600 py-3 text-sm font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950"
        >
          {recap.sessionId ? t('workout.viewSession') : t('common:ok')}
        </button>
      </div>
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
  onDone: (recap: WorkoutRecapResponse) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('gym')
  const elapsedMin = Math.max(
    1,
    Math.round((Date.now() - new Date(detail.log.startedAt).getTime()) / 60000),
  )
  const [effort, setEffort] = useState<PerceivedEffort>('COMME_PREVU')
  const [pain, setPain] = useState(false)

  // anything still queued must land before the workout is closed server-side
  const mutation = useMutation({
    mutationFn: async (body: { durationMin: number; comment?: string }) => {
      await gymQueue.drain()
      return finishWorkout(detail.log.id, { ...body, perceivedEffort: effort, painFlag: pain })
    },
    onSuccess: onDone,
  })

  const field =
    'w-full rounded-lg border border-moss-200 bg-moss-100 px-2 py-2 text-base outline-none focus:border-pine-600 dark:border-moss-750 dark:bg-moss-800'

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
          <input name="durationMin" type="number" min={1} defaultValue={elapsedMin}
            className={`${field} mt-1 max-w-32 tabular-nums`} />
        </label>
        <div>
          <span className="text-sm font-medium">{t('workout.howWasIt')}</span>
          <p className={`mt-0.5 text-xs ${muted}`}>{t('workout.howWasItHint')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEffort(e)}
                aria-pressed={effort === e}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  effort === e
                    ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                    : 'bg-moss-100 text-moss-500 hover:text-ink dark:bg-moss-800 dark:text-moss-400 dark:hover:text-linen'
                }`}
              >
                {t(`workout.effort.${e}`)}
              </button>
            ))}
          </div>
          <p className={`mt-1.5 text-xs ${muted}`}>
            {t('workout.loadPreview', { load: Math.round(elapsedMin * EFFORT_RATE[effort]) })}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)}
            className="h-4 w-4 accent-clay-500" />
          {t('workout.pain')}
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('workout.commentLabel')}</span>
          <textarea name="comment" rows={2} className={`${field} mt-1`} />
        </label>
        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={mutation.isPending}
            className="rounded-lg bg-pine-600 px-4 py-2.5 text-sm font-semibold text-moss-25 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950">
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
