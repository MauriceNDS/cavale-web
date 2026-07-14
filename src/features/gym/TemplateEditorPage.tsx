import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ApiError } from '../../lib/api'
import { ExerciseForm } from './ExerciseForm'
import {
  addAlternative,
  addTemplateExercise,
  addVariant,
  copyVariant,
  deleteTemplate,
  deleteVariant,
  fetchExercises,
  fetchTemplate,
  fetchVariant,
  removeAlternative,
  removeTemplateExercise,
  reorderExercises,
  updateTemplate,
  updateTemplateExercise,
  type ExerciseResponse,
  type TemplateExerciseRequest,
  type TemplateExerciseResponse,
} from './api'
import {
  CATEGORY_BADGE,
  CATEGORY_EDGE,
  CATEGORY_LABEL,
  formatPrescription,
  formatRest,
} from './labels'

const muted = 'text-moss-500 dark:text-moss-400'
const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'
const actionBtn =
  'rounded-lg border border-moss-200 px-2.5 py-1 text-xs font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:border-moss-750 dark:hover:bg-moss-800'

/** One program: variant tabs, ordered prescriptions, alternatives. */
export function TemplateEditorPage() {
  const params = useParams({ strict: false }) as { templateId?: string }
  const templateId = params.templateId!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [variantId, setVariantId] = useState<string | null>(null)

  const templateQuery = useQuery({
    queryKey: ['gym-template', templateId],
    queryFn: () => fetchTemplate(templateId),
  })
  const template = templateQuery.data
  const activeVariantId = variantId ?? template?.variants[0]?.id ?? null

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['gym-template', templateId] })
    void queryClient.invalidateQueries({ queryKey: ['gym-templates'] })
    if (activeVariantId) {
      void queryClient.invalidateQueries({ queryKey: ['gym-variant', activeVariantId] })
    }
  }

  const addVariantMutation = useMutation({
    mutationFn: () => {
      const label = nextLabel(template?.variants.map((v) => v.label) ?? [])
      return addVariant(templateId, { label })
    },
    onSuccess: (variant) => {
      invalidate()
      setVariantId(variant.id)
    },
  })

  const copyVariantMutation = useMutation({
    mutationFn: () => {
      const label = nextLabel(template?.variants.map((v) => v.label) ?? [])
      return copyVariant(activeVariantId!, { label })
    },
    onSuccess: (variant) => {
      invalidate()
      setVariantId(variant.id)
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: () => deleteVariant(activeVariantId!),
    onSuccess: () => {
      setVariantId(null)
      invalidate()
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: () => deleteTemplate(templateId),
    onSuccess: () => void navigate({ to: '/renfo' }),
  })

  if (templateQuery.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>Chargement…</p>
  }
  if (!template) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">Programme introuvable.</p>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <Link
        to="/renfo"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
      >
        ← Programmes
      </Link>

      <TemplateHeader
        template={template}
        onSaved={invalidate}
        onDelete={() => {
          if (window.confirm(`Supprimer « ${template.name} » et tout son contenu ?`)) {
            deleteTemplateMutation.mutate()
          }
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {template.variants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => setVariantId(variant.id)}
            aria-pressed={variant.id === activeVariantId}
            className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition ${
              variant.id === activeVariantId
                ? 'bg-copper-600 text-moss-25 dark:bg-copper-300 dark:text-moss-950'
                : 'bg-copper-600/15 text-copper-600 hover:bg-copper-600/25 dark:bg-copper-300/15 dark:text-copper-300'
            }`}
          >
            {variant.label}
          </button>
        ))}
        <button onClick={() => addVariantMutation.mutate()} className={actionBtn} title="Nouvelle variante vide">
          + variante
        </button>
        <button
          onClick={() => copyVariantMutation.mutate()}
          disabled={!activeVariantId}
          className={actionBtn}
          title="Dupliquer la variante affichée"
        >
          dupliquer
        </button>
        {template.variants.length > 1 && (
          <button
            onClick={() => deleteVariantMutation.mutate()}
            disabled={!activeVariantId}
            className={`${actionBtn} text-clay-500 dark:text-clay-300`}
          >
            supprimer
          </button>
        )}
      </div>

      {activeVariantId && <VariantEditor key={activeVariantId} variantId={activeVariantId} />}
    </div>
  )
}

function nextLabel(existing: string[]): string {
  const alphabet = 'ABCDEFGHIJ'
  for (const letter of alphabet) {
    if (!existing.some((label) => label.toUpperCase() === letter)) return letter
  }
  return `V${existing.length + 1}`
}

function TemplateHeader({
  template,
  onSaved,
  onDelete,
}: {
  template: { id: string; name: string; goal: string | null }
  onSaved: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const mutation = useMutation({
    mutationFn: (body: { name: string; goal?: string }) => updateTemplate(template.id, body),
    onSuccess: () => {
      setEditing(false)
      onSaved()
    },
  })

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <h1 className="font-display text-3xl font-semibold">{template.name}</h1>
        {template.goal && <p className={`text-sm ${muted}`}>{template.goal}</p>}
        <button onClick={() => setEditing(true)} className={`text-sm font-medium text-pine-700 underline dark:text-pine-300`}>
          modifier
        </button>
        <button onClick={onDelete} className="text-sm font-medium text-clay-500 underline dark:text-clay-300">
          supprimer
        </button>
      </div>
    )
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        mutation.mutate({
          name: (data.get('name') as string).trim(),
          goal: ((data.get('goal') as string) || '').trim() || undefined,
        })
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Nom</span>
        <input name="name" required defaultValue={template.name} className={fieldClass} />
      </label>
      <label className="block grow">
        <span className="text-sm font-medium">Objectif</span>
        <input name="goal" defaultValue={template.goal ?? ''} className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        OK
      </button>
      <button type="button" onClick={() => setEditing(false)} className={`px-2 py-2 text-sm ${muted}`}>
        Annuler
      </button>
    </form>
  )
}

/* ── Variant content ───────────────────────────────────────────────── */

type PanelState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; te: TemplateExerciseResponse }
  | { kind: 'alternative'; te: TemplateExerciseResponse }

function VariantEditor({ variantId }: { variantId: string }) {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<PanelState>({ kind: 'closed' })

  const query = useQuery({
    queryKey: ['gym-variant', variantId],
    queryFn: () => fetchVariant(variantId),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['gym-variant', variantId] })
    void queryClient.invalidateQueries({ queryKey: ['gym-template'] })
    void queryClient.invalidateQueries({ queryKey: ['gym-templates'] })
  }

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderExercises(variantId, orderedIds),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (templateExerciseId: string) => removeTemplateExercise(templateExerciseId),
    onSuccess: invalidate,
  })

  const removeAltMutation = useMutation({
    mutationFn: (alternativeId: string) => removeAlternative(alternativeId),
    onSuccess: invalidate,
  })

  const detail = query.data
  if (query.isLoading || !detail) {
    return <p className={`mt-6 text-center ${muted}`}>Chargement…</p>
  }

  function move(index: number, delta: number) {
    const ids = detail!.exercises.map((e) => e.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderMutation.mutate(ids)
  }

  return (
    <div className="mt-4">
      {detail.exercises.length === 0 && panel.kind === 'closed' && (
        <p className={`my-6 text-center ${muted}`}>
          Variante vide — ajoute le premier exercice.
        </p>
      )}

      <div className="space-y-2">
        {detail.exercises.map((te, index) => (
          <div
            key={te.id}
            className={`rounded-lg border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[te.exercise.category]}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter" className="text-xs text-moss-500 disabled:opacity-30 dark:text-moss-400">▲</button>
                <button onClick={() => move(index, 1)} disabled={index === detail.exercises.length - 1} aria-label="Descendre" className="text-xs text-moss-500 disabled:opacity-30 dark:text-moss-400">▼</button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {te.exercise.name}{' '}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[te.exercise.category]}`}>
                    {CATEGORY_LABEL[te.exercise.category]}
                  </span>
                </p>
                <p className={`text-xs ${muted}`}>
                  {formatPrescription(te.sets, te.reps, te.seconds)}
                  {te.intensityPct != null && ` · ${te.intensityPct} %`}
                  {formatRest(te.restSec) != null && ` · ${formatRest(te.restSec)}`}
                  {te.note && ` · ${te.note}`}
                </p>
              </div>
              <button onClick={() => setPanel({ kind: 'edit', te })} className={actionBtn}>
                modifier
              </button>
              <button
                onClick={() => removeMutation.mutate(te.id)}
                className={`${actionBtn} text-clay-500 dark:text-clay-300`}
              >
                retirer
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
              <span className={`text-[11px] uppercase tracking-wide ${muted}`}>Alternatives :</span>
              {te.alternatives.map((alt) => (
                <span
                  key={alt.id}
                  className="inline-flex items-center gap-1 rounded-full bg-moss-100 px-2 py-0.5 text-xs dark:bg-moss-800"
                >
                  {alt.exercise.name}
                  <button
                    onClick={() => removeAltMutation.mutate(alt.id)}
                    aria-label={`Retirer l'alternative ${alt.exercise.name}`}
                    className="text-moss-500 hover:text-clay-500 dark:text-moss-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                onClick={() => setPanel({ kind: 'alternative', te })}
                className="text-xs font-medium text-pine-700 underline dark:text-pine-300"
              >
                + ajouter
              </button>
            </div>
          </div>
        ))}
      </div>

      {panel.kind === 'closed' && (
        <button
          onClick={() => setPanel({ kind: 'add' })}
          className="mt-3 w-full rounded-lg border border-dashed border-moss-300 px-3 py-2.5 text-sm font-medium text-moss-500 transition hover:border-pine-600 hover:text-pine-700 dark:border-moss-700 dark:text-moss-400 dark:hover:border-pine-350 dark:hover:text-pine-300"
        >
          + Ajouter un exercice
        </button>
      )}

      {panel.kind === 'add' && (
        <PrescriptionPanel
          title="Ajouter un exercice"
          onSubmit={(body) => addTemplateExercise(variantId, body)}
          onDone={() => {
            invalidate()
            setPanel({ kind: 'closed' })
          }}
          onCancel={() => setPanel({ kind: 'closed' })}
        />
      )}
      {panel.kind === 'edit' && (
        <PrescriptionPanel
          title={`Modifier « ${panel.te.exercise.name} »`}
          existing={panel.te}
          onSubmit={(body) => updateTemplateExercise(panel.te.id, body)}
          onDone={() => {
            invalidate()
            setPanel({ kind: 'closed' })
          }}
          onCancel={() => setPanel({ kind: 'closed' })}
        />
      )}
      {panel.kind === 'alternative' && (
        <AlternativePanel
          te={panel.te}
          onDone={() => {
            invalidate()
            setPanel({ kind: 'closed' })
          }}
          onCancel={() => setPanel({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

/* ── Exercise picker (library search + inline creation) ────────────── */

function ExercisePicker({
  selected,
  onSelect,
  onClear,
  exclude,
}: {
  selected: ExerciseResponse | null
  onSelect: (exercise: ExerciseResponse) => void
  onClear?: () => void
  exclude?: string[]
}) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const query = useQuery({ queryKey: ['exercises'], queryFn: fetchExercises })

  const matches = (query.data ?? [])
    .filter((e) => !e.archived && !(exclude ?? []).includes(e.id))
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8)

  if (creating) {
    return (
      <ExerciseForm
        initialName={search.trim()}
        onSaved={(saved) => {
          setCreating(false)
          onSelect(saved)
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  if (selected) {
    return (
      <p className="text-sm">
        Exercice : <span className="font-medium">{selected.name}</span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-2 text-xs font-medium text-pine-700 underline dark:text-pine-300"
          >
            changer
          </button>
        )}
      </p>
    )
  }

  return (
    <div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Chercher dans la bibliothèque…"
        aria-label="Chercher un exercice"
        className={fieldClass}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {matches.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onSelect(exercise)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${CATEGORY_BADGE[exercise.category]} hover:ring-1 hover:ring-current`}
          >
            {exercise.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full border border-dashed border-moss-300 px-2.5 py-1 text-xs font-medium text-moss-500 transition hover:border-pine-600 hover:text-pine-700 dark:border-moss-700 dark:text-moss-400 dark:hover:border-pine-350 dark:hover:text-pine-300"
        >
          + Créer {search.trim() ? `« ${search.trim()} »` : 'un exercice'}
        </button>
      </div>
    </div>
  )
}

/* ── Prescription form ─────────────────────────────────────────────── */

function PrescriptionPanel({
  title,
  existing,
  onSubmit,
  onDone,
  onCancel,
}: {
  title: string
  existing?: TemplateExerciseResponse
  onSubmit: (body: TemplateExerciseRequest) => Promise<unknown>
  onDone: () => void
  onCancel: () => void
}) {
  const [exercise, setExercise] = useState<ExerciseResponse | null>(existing?.exercise ?? null)
  const mutation = useMutation({ mutationFn: onSubmit, onSuccess: onDone })
  const seconds = exercise?.measure === 'SECONDS'

  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850"
      onSubmit={(event) => {
        event.preventDefault()
        if (!exercise) return
        const data = new FormData(event.currentTarget)
        const num = (key: string) => {
          const raw = (data.get(key) as string) || ''
          return raw ? Number(raw) : undefined
        }
        mutation.mutate({
          exerciseId: exercise.id,
          sets: num('sets') ?? 3,
          reps: seconds ? undefined : num('reps'),
          seconds: seconds ? num('seconds') : undefined,
          restSec: num('restSec'),
          intensityPct: num('intensityPct'),
          note: ((data.get('note') as string) || '').trim() || undefined,
        })
      }}
    >
      <p className="text-sm font-semibold">{title}</p>
      <ExercisePicker selected={exercise} onSelect={setExercise} onClear={() => setExercise(null)} />

      {exercise && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium">Séries</span>
              <input name="sets" type="number" min={1} required defaultValue={existing?.sets ?? 3} className={fieldClass} />
            </label>
            {seconds ? (
              <label className="block">
                <span className="text-sm font-medium">Secondes</span>
                <input name="seconds" type="number" min={1} required defaultValue={existing?.seconds ?? 45} className={fieldClass} />
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium">Reps</span>
                <input name="reps" type="number" min={1} required defaultValue={existing?.reps ?? 6} className={fieldClass} />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">Repos (sec)</span>
              <input name="restSec" type="number" min={0} defaultValue={existing?.restSec ?? ''} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">% 1RM</span>
              <input name="intensityPct" type="number" min={1} max={200} defaultValue={existing?.intensityPct ?? ''} className={fieldClass} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Note</span>
            <input name="note" maxLength={300} defaultValue={existing?.note ?? ''} placeholder="Tempo 5-0-1, lesté si facile…" className={fieldClass} />
          </label>
        </>
      )}

      {mutation.error instanceof ApiError && (
        <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!exercise || mutation.isPending}
          className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
        >
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onCancel} className={`px-3 py-2 text-sm font-medium ${muted}`}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/* ── Alternative picker ────────────────────────────────────────────── */

function AlternativePanel({
  te,
  onDone,
  onCancel,
}: {
  te: TemplateExerciseResponse
  onDone: () => void
  onCancel: () => void
}) {
  const mutation = useMutation({
    mutationFn: (exerciseId: string) => addAlternative(te.id, exerciseId),
    onSuccess: onDone,
  })

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-moss-200 bg-moss-25 p-4 dark:border-moss-750 dark:bg-moss-850">
      <p className="text-sm font-semibold">
        Alternative pour « {te.exercise.name} » (machine occupée, pas de salle…)
      </p>
      <ExercisePicker
        selected={null}
        onSelect={(exercise) => mutation.mutate(exercise.id)}
        exclude={[te.exercise.id, ...te.alternatives.map((a) => a.exercise.id)]}
      />
      {mutation.error instanceof ApiError && (
        <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
          {mutation.error.message}
        </p>
      )}
      <button onClick={onCancel} className={`px-1 text-sm font-medium ${muted}`}>
        Annuler
      </button>
    </div>
  )
}
