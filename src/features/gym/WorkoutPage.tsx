import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { muted } from '../../lib/ui'
import {
  abandonWorkout,
  addExtraBlock,
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
import { CATEGORY_BADGE, CATEGORY_EDGE, categoryLabel, formatRest } from './labels'

const inputCls =
  'w-full rounded-lg border border-moss-200 bg-moss-100 px-2 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

const EFFORTS: PerceivedEffort[] = [
  'TROP_FACILE', 'FACILE', 'COMME_PREVU', 'DIFFICILE', 'TROP_DIFFICILE',
]

function formatElapsed(startedAt: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** The live workout: tick a set, it's saved; lock your phone, nothing is lost. */
export function WorkoutPage() {
  const { t } = useTranslation('gym')
  const params = useParams({ strict: false }) as { workoutId?: string }
  const workoutId = params.workoutId!
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [finishing, setFinishing] = useState(false)

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
        {detail.blocks.map((block) => (
          <BlockCard key={block.templateExerciseId ?? block.extraBlockId} workoutId={workoutId}
            block={block} loggedSets={detail.log.sets} readOnly={finished} />
        ))}
        {detail.blocks.length === 0 && (
          <p className={`text-center text-sm ${muted}`}>
            {t('workout.templateGone')}
          </p>
        )}
        {!finished && <AddExercisePanel workoutId={workoutId} blocks={detail.blocks} />}
      </div>

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

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-moss-200 bg-moss-50/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border dark:border-moss-750 dark:bg-moss-900/95">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">
            {detail.log.templateName ?? t('workout.untitled')}
          </p>
          {!finished && (
            <p className={`text-sm tabular-nums ${muted}`}>⏱ {formatElapsed(detail.log.startedAt)}</p>
          )}
        </div>
        {!finished && (
          <>
            <button
              onClick={() => {
                if (window.confirm(t('workout.abandonConfirm'))) {
                  abandonMutation.mutate()
                }
              }}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-clay-500 transition hover:bg-clay-100 dark:text-clay-300 dark:hover:bg-clay-900"
            >
              {t('workout.abandon')}
            </button>
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

/* ── One exercise block ────────────────────────────────────────────── */

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
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [restLeft, setRestLeft] = useState<number | null>(null)
  const [extraRows, setExtraRows] = useState(0)

  // Swaps, skips and additions are persisted server-side — a reload keeps them.
  const exercise = block.exercise
  const swapped = block.swappedFrom != null
  const isExtra = block.extraBlockId != null
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })

  const swapMutation = useMutation({
    mutationFn: (exerciseId: string) =>
      swapWorkoutBlock(workoutId, block.templateExerciseId!, exerciseId),
    onSuccess: invalidate,
  })
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

  // Sets are elastic: the prescription is a starting point, logged sets never
  // disappear, and « + série » opens extra rows for this workout.
  const maxLogged = loggedSets
    .filter((s) => s.exerciseId === exercise.id)
    .reduce((max, s) => Math.max(max, s.setNumber), 0)
  const totalRows = Math.max(block.sets + extraRows, maxLogged)
  const canRemoveRow = extraRows > 0 && totalRows > block.sets && totalRows > maxLogged

  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return
    const t = setTimeout(() => {
      const next = restLeft - 1
      setRestLeft(next > 0 ? next : null)
      if (next <= 0 && 'vibrate' in navigator) navigator.vibrate?.(300)
    }, 1000)
    return () => clearTimeout(t)
  }, [restLeft])

  if (block.skipped) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-moss-200 bg-moss-25/60 px-3 py-2.5 dark:border-moss-750 dark:bg-moss-850/60">
        <p className={`min-w-0 flex-1 truncate text-sm line-through ${muted}`}>{exercise.name}</p>
        <span className={`shrink-0 text-xs ${muted}`}>{t('workout.skipped')}</span>
        {!readOnly && (
          <button
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="shrink-0 text-xs font-medium text-pine-700 underline disabled:opacity-50 dark:text-pine-300"
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

  return (
    <div
      className={`rounded-xl border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[exercise.category]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {exercise.name}
          {swapped && <span className={`ml-1 text-xs ${muted}`}>{t('workout.insteadOf', { name: block.swappedFrom!.name })}</span>}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[exercise.category]}`}>
          {categoryLabel(exercise.category)}
        </span>
        {isExtra && (
          <span className={`rounded-full bg-copper-600/15 px-2 py-0.5 text-[11px] font-medium text-copper-600 dark:bg-copper-300/15 dark:text-copper-300`}>
            {t('workout.extraTag')}
          </span>
        )}
        {!readOnly && (
          <span className="ml-auto flex items-center gap-2.5">
            {!isExtra && (block.alternatives.length > 0 || swapped) && (
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-xs font-medium text-pine-700 underline dark:text-pine-300"
              >
                {t('workout.replace')}
              </button>
            )}
            <button
              onClick={() => {
                if (isExtra) {
                  if (window.confirm(t('workout.removeExtraConfirm'))) removeExtraMutation.mutate()
                } else {
                  skipMutation.mutate()
                }
              }}
              disabled={skipMutation.isPending || removeExtraMutation.isPending}
              className="text-xs font-medium text-clay-500 underline disabled:opacity-50 dark:text-clay-300"
            >
              {t('workout.skipBlock')}
            </button>
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-xs ${muted}`}>{prescription}</p>
      {(recordLine || lastLine) && (
        <p className={`mt-0.5 text-xs ${muted}`}>
          {[recordLine, lastLine].filter(Boolean).join(' · ')}
        </p>
      )}

      {showAlternatives && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[block.swappedFrom ?? block.exercise, ...block.alternatives].map((alt) => (
            <button
              key={alt.id}
              onClick={() => {
                if (alt.id !== exercise.id) swapMutation.mutate(alt.id)
                setShowAlternatives(false)
              }}
              disabled={swapMutation.isPending}
              aria-pressed={alt.id === exercise.id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                alt.id === exercise.id
                  ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                  : 'bg-moss-100 text-moss-500 hover:text-ink dark:bg-moss-800 dark:text-moss-400 dark:hover:text-linen'
              }`}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}
      {(swapMutation.error ?? skipMutation.error) instanceof ApiError && (
        <p role="alert" className="mt-1 text-xs text-clay-500 dark:text-clay-300">
          {t('workout.adjustFailed')}
        </p>
      )}

      {restLeft != null && (
        <p className="mt-2 rounded-lg bg-copper-600/15 px-3 py-1.5 text-sm font-semibold text-copper-600 tabular-nums dark:bg-copper-300/15 dark:text-copper-300">
          {t('workout.restCountdown', { time: `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}` })}
        </p>
      )}

      <div className="mt-2 space-y-1.5">
        {Array.from({ length: totalRows }, (_, i) => i + 1).map((setNumber) => (
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
              if (block.restSec != null && setNumber < totalRows) setRestLeft(block.restSec)
            }}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="mt-1.5 flex gap-3">
          <button
            onClick={() => setExtraRows(totalRows + 1 - block.sets)}
            className={`text-xs font-medium underline ${muted} hover:text-ink dark:hover:text-linen`}
          >
            {t('workout.addSet')}
          </button>
          {canRemoveRow && (
            <button
              onClick={() => setExtraRows(extraRows - 1)}
              className={`text-xs font-medium underline ${muted} hover:text-ink dark:hover:text-linen`}
            >
              {t('workout.removeSet')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── One set row: inputs prefilled with last time, one tap to save ──── */

function SetRow({
  workoutId,
  block,
  exercise,
  setNumber,
  logged,
  readOnly,
  onSaved,
}: {
  workoutId: string
  block: WorkoutBlockResponse
  exercise: ExerciseResponse
  setNumber: number
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
      <span className={`w-5 shrink-0 text-center text-xs font-semibold ${muted}`}>{setNumber}</span>
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

function AddExercisePanel({
  workoutId,
  blocks,
}: {
  workoutId: string
  blocks: WorkoutBlockResponse[]
}) {
  const { t } = useTranslation('gym')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState('')

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: fetchExercises,
    enabled: open,
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
      setOpen(false)
      setExerciseId('')
      void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] })
    },
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`w-full rounded-xl border border-dashed border-moss-200 px-3 py-2.5 text-sm font-medium ${muted} transition hover:bg-moss-100 dark:border-moss-750 dark:hover:bg-moss-800`}
      >
        {t('workout.addExercise')}
      </button>
    )
  }

  return (
    <form
      className="space-y-2.5 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850"
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
      <p className="text-sm font-semibold">{t('workout.addExerciseTitle')}</p>
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!chosen || mutation.isPending}
          className="rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {t('workout.addBlock')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`px-2 py-1.5 text-sm font-medium ${muted}`}
        >
          {t('common:cancel')}
        </button>
      </div>
    </form>
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
    <form
      className="mt-4 space-y-3 rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        mutation.mutate({
          durationMin: Number(data.get('durationMin')) || elapsedMin,
          comment: ((data.get('comment') as string) || '').trim() || undefined,
        })
      }}
    >
      <p className="text-sm font-semibold">{t('workout.finishTitle')}</p>
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
  )
}
