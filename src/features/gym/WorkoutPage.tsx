import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ApiError } from '../../lib/api'
import {
  abandonWorkout,
  fetchWorkout,
  finishWorkout,
  logSet,
  type ExerciseResponse,
  type PerceivedEffort,
  type SetLogResponse,
  type WorkoutBlockResponse,
  type WorkoutDetailResponse,
} from './api'
import { CATEGORY_BADGE, CATEGORY_EDGE, CATEGORY_LABEL, formatRest } from './labels'

const muted = 'text-moss-500 dark:text-moss-400'
const inputCls =
  'w-full rounded-lg border border-moss-200 bg-moss-100 px-2 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

const EFFORT_LABEL: Record<PerceivedEffort, string> = {
  TROP_FACILE: 'Trop facile',
  FACILE: 'Facile',
  COMME_PREVU: 'Comme prévu',
  DIFFICILE: 'Difficile',
  TROP_DIFFICILE: 'Trop difficile',
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

/** The live workout: tick a set, it's saved; lock your phone, nothing is lost. */
export function WorkoutPage() {
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
    return <p className={`mt-10 text-center ${muted}`}>Chargement…</p>
  }
  if (!detail) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">Entraînement introuvable.</p>
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
          Séance terminée en {detail.log.durationMin} min — bien joué.{' '}
          {detail.log.sessionId && (
            <Link
              to="/session/$sessionId"
              params={{ sessionId: detail.log.sessionId }}
              className="underline"
            >
              Voir la séance
            </Link>
          )}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {detail.blocks.map((block) => (
          <BlockCard key={block.templateExerciseId} workoutId={workoutId} block={block}
            loggedSets={detail.log.sets} readOnly={finished} />
        ))}
        {detail.blocks.length === 0 && (
          <p className={`text-center text-sm ${muted}`}>
            Le programme lié n'existe plus — les séries enregistrées restent ci-dessous.
          </p>
        )}
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
            {detail.log.templateName ?? 'Entraînement'}
          </p>
          {!finished && (
            <p className={`text-sm tabular-nums ${muted}`}>⏱ {formatElapsed(detail.log.startedAt)}</p>
          )}
        </div>
        {!finished && (
          <>
            <button
              onClick={() => {
                if (window.confirm('Abandonner cette séance ? Les séries seront perdues.')) {
                  abandonMutation.mutate()
                }
              }}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-clay-500 transition hover:bg-clay-100 dark:text-clay-300 dark:hover:bg-clay-900"
            >
              Abandonner
            </button>
            <button
              onClick={onFinish}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              ✓ Terminer
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
  // Swap to an alternative: sets log against the replacement exercise.
  const [exercise, setExercise] = useState<ExerciseResponse>(block.exercise)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [restLeft, setRestLeft] = useState<number | null>(null)

  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return
    const t = setTimeout(() => {
      const next = restLeft - 1
      setRestLeft(next > 0 ? next : null)
      if (next <= 0 && 'vibrate' in navigator) navigator.vibrate?.(300)
    }, 1000)
    return () => clearTimeout(t)
  }, [restLeft])

  const seconds = exercise.measure === 'SECONDS'
  const swapped = exercise.id !== block.exercise.id

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
    ? `Dernière fois : ${block.lastSets
        .map((s) => (s.seconds != null ? `${s.seconds}s` : `${s.weightKg ?? 'PDC'}${s.weightKg != null ? ' kg' : ''}`))
        .join(' / ')}`
    : null
  const recordLine = block.recordWeightKg != null
    ? `Record : ${block.recordWeightKg} kg × ${block.targetReps}`
    : null

  return (
    <div
      className={`rounded-xl border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[exercise.category]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {exercise.name}
          {swapped && <span className={`ml-1 text-xs ${muted}`}>(à la place de {block.exercise.name})</span>}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[exercise.category]}`}>
          {CATEGORY_LABEL[exercise.category]}
        </span>
        {block.alternatives.length > 0 && !readOnly && (
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="ml-auto text-xs font-medium text-pine-700 underline dark:text-pine-300"
          >
            remplacer
          </button>
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
          {[block.exercise, ...block.alternatives].map((alt) => (
            <button
              key={alt.id}
              onClick={() => {
                setExercise(alt)
                setShowAlternatives(false)
              }}
              aria-pressed={alt.id === exercise.id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
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

      {restLeft != null && (
        <p className="mt-2 rounded-lg bg-copper-600/15 px-3 py-1.5 text-sm font-semibold text-copper-600 tabular-nums dark:bg-copper-300/15 dark:text-copper-300">
          Repos : {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
        </p>
      )}

      <div className="mt-2 space-y-1.5">
        {Array.from({ length: block.sets }, (_, i) => i + 1).map((setNumber) => (
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
              if (block.restSec != null && setNumber < block.sets) setRestLeft(block.restSec)
            }}
          />
        ))}
      </div>
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
  const [saved, setSaved] = useState(logged != null)
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  const seconds = exercise.measure === 'SECONDS'
  const bodyweight = exercise.measure === 'BODYWEIGHT_REPS'
  // prefill: what I did on this set LAST time, else the prescription target
  const lastSame = block.lastSets.find((s) => s.setNumber === setNumber)

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
      setSaved(true)
      onSaved()
    },
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
            aria-label={`Série ${setNumber} — secondes`}
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
              aria-label={`Série ${setNumber} — poids (kg)`}
              placeholder={bodyweight ? 'PDC' : 'kg'}
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
              aria-label={`Série ${setNumber} — répétitions`}
              defaultValue={logged?.reps ?? lastSame?.reps ?? block.targetReps ?? ''}
              className={inputCls}
              disabled={readOnly}
            />
          </div>
        </>
      )}
      {!readOnly && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          aria-label={`Valider la série ${setNumber}`}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg font-semibold transition disabled:opacity-50 ${
            saved
              ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
              : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
          }`}
        >
          ✓
        </button>
      )}
      {mutation.error instanceof ApiError && (
        <span role="alert" className="text-xs text-clay-500 dark:text-clay-300">
          Échec
        </span>
      )}
    </div>
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
      <p className="text-sm font-semibold">Terminer la séance</p>
      <label className="block">
        <span className="text-sm font-medium">Durée totale (min)</span>
        <input
          name="durationMin"
          type="number"
          min={1}
          defaultValue={elapsedMin}
          className={`${inputCls} mt-1 max-w-32 text-left`}
        />
      </label>
      <div>
        <span className="text-sm font-medium">Comment c'était ?</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(Object.keys(EFFORT_LABEL) as PerceivedEffort[]).map((e) => (
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
              {EFFORT_LABEL[e]}
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
        Douleur / gêne ressentie
      </label>
      <label className="block">
        <span className="text-sm font-medium">Un mot sur la séance ? (optionnel)</span>
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
          {mutation.isPending ? 'Enregistrement…' : '✓ Enregistrer la séance'}
        </button>
        <button type="button" onClick={onCancel} className={`px-3 py-2 text-sm font-medium ${muted}`}>
          Continuer l'entraînement
        </button>
      </div>
    </form>
  )
}
