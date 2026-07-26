import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Copy, Link2, Pencil, Plus, Trash2, Unlink2, X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { muted } from '../../lib/ui'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import { ExerciseForm } from './ExerciseForm'
import {
  addAlternative,
  addTemplateExercise,
  addVariant,
  assignGroups,
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
  categoryLabel,
  formatPrescription,
  formatRest,
} from './labels'

const fieldClass =
  'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'
const actionBtn =
  'rounded-lg border border-moss-200 px-2.5 py-1 text-xs font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:border-moss-750 dark:hover:bg-moss-800'
const iconBtn =
  'grid h-9 w-9 place-items-center rounded-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen'
/** Buttons inside the bordered variant-action cluster: no own border. */
const clusterBtn =
  'flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:hover:bg-moss-800'

/** One program: variant tabs, ordered prescriptions, alternatives. */
export function TemplateEditorPage() {
  const { t } = useTranslation('gym')
  const params = useParams({ strict: false }) as { templateId?: string }
  const templateId = params.templateId!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [variantId, setVariantId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'program' | 'variant' | null>(null)

  const templateQuery = useQuery({
    queryKey: ['gym-template', templateId],
    queryFn: () => fetchTemplate(templateId),
  })
  const template = templateQuery.data
  const activeVariantId = variantId ?? template?.variants[0]?.id ?? null
  const activeLabel = template?.variants.find((v) => v.id === activeVariantId)?.label ?? null

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
      setConfirming(null)
      invalidate()
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: () => deleteTemplate(templateId),
    onSuccess: () => void navigate({ to: '/renfo' }),
  })

  if (templateQuery.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!template) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('editor.notFound')}</p>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <Link
        to="/renfo"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
      >
        {t('editor.back')}
      </Link>

      <TemplateHeader
        template={template}
        onSaved={invalidate}
        onDelete={() => setConfirming('program')}
      />

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {template.variants.map((variant) => (
          <button
            key={variant.id}
            onClick={() => setVariantId(variant.id)}
            aria-pressed={variant.id === activeVariantId}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              variant.id === activeVariantId
                ? 'bg-copper-600 text-moss-25 dark:bg-copper-300 dark:text-moss-950'
                : 'bg-copper-600/15 text-copper-600 hover:bg-copper-600/25 dark:bg-copper-300/15 dark:text-copper-300'
            }`}
          >
            {variant.label}
          </button>
        ))}
        {/* Variant actions, grouped apart from the tabs so they read as one
            family — and can't be mistaken for the program-level actions. */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-moss-200 p-0.5 dark:border-moss-750">
          <button
            onClick={() => addVariantMutation.mutate()}
            className={clusterBtn}
            title={t('editor.addVariantTitle')}
          >
            <Plus size={14} aria-hidden />
            {t('editor.addVariant')}
          </button>
          <button
            onClick={() => copyVariantMutation.mutate()}
            disabled={!activeVariantId}
            className={clusterBtn}
            title={t('editor.duplicateVariant', { label: activeLabel ?? '' })}
            aria-label={t('editor.duplicateVariant', { label: activeLabel ?? '' })}
          >
            <Copy size={14} aria-hidden />
          </button>
          {template.variants.length > 1 && (
            <button
              onClick={() => setConfirming('variant')}
              disabled={!activeVariantId}
              className={`${clusterBtn} text-clay-500 dark:text-clay-300`}
              title={t('editor.deleteVariant', { label: activeLabel ?? '' })}
              aria-label={t('editor.deleteVariant', { label: activeLabel ?? '' })}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {activeVariantId && <VariantEditor key={activeVariantId} variantId={activeVariantId} />}

      {confirming === 'program' && (
        <ConfirmDialog
          title={t('editor.deleteProgram')}
          message={t('editor.deleteConfirm', { name: template.name })}
          confirmLabel={t('common:delete')}
          danger
          busy={deleteTemplateMutation.isPending}
          onConfirm={() => deleteTemplateMutation.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'variant' && activeLabel != null && (
        <ConfirmDialog
          title={t('editor.deleteVariant', { label: activeLabel })}
          message={t('editor.deleteVariantConfirm', { label: activeLabel })}
          confirmLabel={t('common:delete')}
          danger
          busy={deleteVariantMutation.isPending}
          onConfirm={() => deleteVariantMutation.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
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
  const { t } = useTranslation('gym')
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
        <button
          onClick={() => setEditing(true)}
          className={iconBtn}
          title={t('editor.renameProgram')}
          aria-label={t('editor.renameProgram')}
        >
          <Pencil size={16} aria-hidden />
        </button>
        <button
          onClick={onDelete}
          className={`${iconBtn} text-clay-500 hover:text-clay-500 dark:text-clay-300 dark:hover:text-clay-300`}
          title={t('editor.deleteProgram')}
          aria-label={t('editor.deleteProgram')}
        >
          <Trash2 size={16} aria-hidden />
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
        <span className="text-sm font-medium">{t('editor.name')}</span>
        <input name="name" required defaultValue={template.name} className={fieldClass} />
      </label>
      <label className="block grow">
        <span className="text-sm font-medium">{t('editor.goal')}</span>
        <input name="goal" defaultValue={template.goal ?? ''} className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
      >
        {t('editor.ok')}
      </button>
      <button type="button" onClick={() => setEditing(false)} className={`px-2 py-2 text-sm ${muted}`}>
        {t('common:cancel')}
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
  | { kind: 'detail'; exercise: ExerciseResponse }

/** First unused letter — group keys are only ever shown, never typed. */
function freeGroupKey(keys: (string | null)[]): string {
  const taken = new Set(keys.filter(Boolean))
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!taken.has(letter)) return letter
  }
  return 'Z'
}

/** Chain prescription `index` with the one below: merge, extend, or open a group. */
function chained(keys: (string | null)[], index: number): (string | null)[] {
  const next = [...keys]
  const here = next[index]
  const below = next[index + 1]
  if (here && below) {
    // two existing groups meet — the lower one is absorbed into the upper
    return next.map((key) => (key === below ? here : key))
  }
  if (here) next[index + 1] = here
  else if (below) next[index] = below
  else {
    const key = freeGroupKey(next)
    next[index] = key
    next[index + 1] = key
  }
  return next
}

/** Break the chain below `index`: what follows becomes its own group. */
function unchained(keys: (string | null)[], index: number): (string | null)[] {
  const next = [...keys]
  const key = next[index]
  const fresh = freeGroupKey(next)
  for (let i = index + 1; i < next.length && next[i] === key; i++) {
    next[i] = fresh
  }
  return next
}

function VariantEditor({ variantId }: { variantId: string }) {
  const { t } = useTranslation('gym')
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

  const groupsMutation = useMutation({
    mutationFn: (assignments: { templateExerciseId: string; groupKey: string | null }[]) =>
      assignGroups(variantId, assignments),
    onSuccess: invalidate,
  })

  const removeAltMutation = useMutation({
    mutationFn: (alternativeId: string) => removeAlternative(alternativeId),
    onSuccess: invalidate,
  })

  const detail = query.data
  if (query.isLoading || !detail) {
    return <p className={`mt-6 text-center ${muted}`}>{t('common:loading')}</p>
  }

  function move(index: number, delta: number) {
    const ids = detail!.exercises.map((e) => e.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderMutation.mutate(ids)
  }

  const groupKeys = detail.exercises.map((e) => e.groupKey)
  // one group holding everything is what a circuit has always been
  const circuit =
    detail.exercises.length > 1 &&
    groupKeys.every((key) => key != null && key === groupKeys[0])
  const rounds = circuit ? Math.max(...detail.exercises.map((e) => e.sets)) : null

  function regroup(keys: (string | null)[]) {
    groupsMutation.mutate(
      detail!.exercises.map((te, i) => ({ templateExerciseId: te.id, groupKey: keys[i] })),
    )
  }

  return (
    <div className="mt-4">
      {circuit && (
        <div className="mb-3">
          <span className="rounded-full bg-teal-600/15 px-2.5 py-1 text-xs font-semibold text-teal-600 dark:bg-teal-300/15 dark:text-teal-300">
            {t('editor.groups.circuitTag', { rounds })}
          </span>
        </div>
      )}

      {detail.exercises.length === 0 && panel.kind === 'closed' && (
        <p className={`my-6 text-center ${muted}`}>
          {t('editor.emptyVariant')}
        </p>
      )}

      <div className="space-y-2">
        {detail.exercises.map((te, index) => (
          <div
            key={te.id}
            className={`rounded-lg border border-l-4 border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850 ${CATEGORY_EDGE[te.exercise.category]} ${
              // a superset reads as one block: its members sit tight together,
              // ringed in teal, with only the outer corners rounded
              te.groupKey == null
                ? ''
                : `relative ring-1 ring-teal-600/40 dark:ring-teal-300/30 ${
                    groupKeys[index - 1] === te.groupKey ? 'mt-0 rounded-t-none' : ''
                  } ${groupKeys[index + 1] === te.groupKey ? 'mb-0 rounded-b-none' : ''}`
            }`}
            style={
              te.groupKey != null && groupKeys[index - 1] === te.groupKey
                ? { marginTop: '-0.5rem' }
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('editor.moveUp')} className="text-moss-500 disabled:opacity-30 dark:text-moss-400"><ChevronUp size={16} aria-hidden /></button>
                <button onClick={() => move(index, 1)} disabled={index === detail.exercises.length - 1} aria-label={t('editor.moveDown')} className="text-moss-500 disabled:opacity-30 dark:text-moss-400"><ChevronDown size={16} aria-hidden /></button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  {te.groupKey != null && (
                    <span className="shrink-0 rounded bg-teal-600/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-600 tabular-nums dark:bg-teal-300/15 dark:text-teal-300">
                      {te.groupKey}
                      {groupKeys.slice(0, index).filter((k) => k === te.groupKey).length + 1}
                    </span>
                  )}
                  <button
                    onClick={() => setPanel({ kind: 'detail', exercise: te.exercise })}
                    className="text-left font-medium underline-offset-2 hover:underline"
                  >
                    {te.exercise.name}
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE[te.exercise.category]}`}>
                    {categoryLabel(te.exercise.category)}
                  </span>
                </div>
                <p className={`text-xs ${muted}`}>
                  {formatPrescription(te.sets, te.reps, te.seconds)}
                  {te.intensityPct != null && ` · ${te.intensityPct} %`}
                  {formatRest(te.restSec) != null &&
                    ` · ${t(
                      te.groupKey != null && groupKeys[index + 1] === te.groupKey
                        ? 'editor.groups.restBeforeNext'
                        : 'editor.groups.restAfter',
                      { rest: formatRest(te.restSec) },
                    )}`}
                  {te.note && ` · ${te.note}`}
                </p>
              </div>
              <button onClick={() => setPanel({ kind: 'edit', te })} className={actionBtn}>
                {t('editor.editLower')}
              </button>
              <button
                onClick={() => removeMutation.mutate(te.id)}
                className={`${actionBtn} text-clay-500 dark:text-clay-300`}
              >
                {t('editor.remove')}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
              <span className={`text-[11px] uppercase tracking-wide ${muted}`}>{t('editor.alternatives')}</span>
              {te.alternatives.map((alt) => (
                <span
                  key={alt.id}
                  className="inline-flex items-center gap-1 rounded-full bg-moss-100 px-2 py-0.5 text-xs dark:bg-moss-800"
                >
                  {alt.exercise.name}
                  <button
                    onClick={() => removeAltMutation.mutate(alt.id)}
                    aria-label={t('editor.removeAlternativeAria', { name: alt.exercise.name })}
                    className="text-moss-500 hover:text-clay-500 dark:text-moss-400"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setPanel({ kind: 'alternative', te })}
                className="text-xs font-medium text-pine-700 underline dark:text-pine-300"
              >
                {t('editor.addAlternative')}
              </button>
            </div>

            {/* the chain to the exercise below: enchaîner makes a superset */}
            {index < detail.exercises.length - 1 && (
              <div className="mt-2 border-t border-dashed border-moss-200 pt-2 pl-6 dark:border-moss-750">
                {te.groupKey != null && groupKeys[index + 1] === te.groupKey ? (
                  <button
                    onClick={() => regroup(unchained(groupKeys, index))}
                    disabled={groupsMutation.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 disabled:opacity-50 dark:text-teal-300"
                  >
                    <Unlink2 size={13} aria-hidden />
                    {t('editor.groups.unchain')}
                  </button>
                ) : (
                  <button
                    onClick={() => regroup(chained(groupKeys, index))}
                    disabled={groupsMutation.isPending}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${muted} transition hover:text-teal-600 disabled:opacity-50 dark:hover:text-teal-300`}
                  >
                    <Link2 size={13} aria-hidden />
                    {t('editor.groups.chain')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {groupsMutation.error instanceof ApiError && (
        <p role="alert" className="mt-2 text-sm text-clay-500 dark:text-clay-300">
          {groupsMutation.error.message}
        </p>
      )}

      <button
        onClick={() => setPanel({ kind: 'add' })}
        className="mt-3 w-full rounded-lg border border-dashed border-moss-300 px-3 py-2.5 text-sm font-medium text-moss-500 transition hover:border-pine-600 hover:text-pine-700 dark:border-moss-700 dark:text-moss-400 dark:hover:border-pine-350 dark:hover:text-pine-300"
      >
        {t('editor.addExercise')}
      </button>

      {panel.kind === 'add' && (
        <Modal title={t('editor.addExerciseTitle')} onClose={() => setPanel({ kind: 'closed' })}>
          <PrescriptionPanel
            onSubmit={(body) => addTemplateExercise(variantId, body)}
            onDone={() => {
              invalidate()
              setPanel({ kind: 'closed' })
            }}
            onCancel={() => setPanel({ kind: 'closed' })}
          />
        </Modal>
      )}
      {panel.kind === 'edit' && (
        <Modal
          title={t('editor.editExerciseTitle', { name: panel.te.exercise.name })}
          onClose={() => setPanel({ kind: 'closed' })}
        >
          <PrescriptionPanel
            existing={panel.te}
            onSubmit={(body) => updateTemplateExercise(panel.te.id, body)}
            onDone={() => {
              invalidate()
              setPanel({ kind: 'closed' })
            }}
            onCancel={() => setPanel({ kind: 'closed' })}
          />
        </Modal>
      )}
      {panel.kind === 'alternative' && (
        <Modal
          title={t('editor.alternativeFor', { name: panel.te.exercise.name })}
          onClose={() => setPanel({ kind: 'closed' })}
        >
          <AlternativePanel
            te={panel.te}
            onDone={() => {
              invalidate()
              setPanel({ kind: 'closed' })
            }}
            onCancel={() => setPanel({ kind: 'closed' })}
          />
        </Modal>
      )}
      {panel.kind === 'detail' && (
        <ExerciseDetailSheet
          exercise={panel.exercise}
          onClose={() => setPanel({ kind: 'closed' })}
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
  const { t } = useTranslation('gym')
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
        {t('editor.picker.exercise')} <span className="font-medium">{selected.name}</span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-2 text-xs font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('editor.picker.change')}
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
        placeholder={t('editor.picker.searchPlaceholder')}
        aria-label={t('editor.picker.searchAria')}
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
          {search.trim() ? t('editor.picker.createNamed', { name: search.trim() }) : t('editor.picker.create')}
        </button>
      </div>
    </div>
  )
}

/* ── Prescription form ─────────────────────────────────────────────── */

function PrescriptionPanel({
  existing,
  onSubmit,
  onDone,
  onCancel,
}: {
  existing?: TemplateExerciseResponse
  onSubmit: (body: TemplateExerciseRequest) => Promise<unknown>
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('gym')
  const [exercise, setExercise] = useState<ExerciseResponse | null>(existing?.exercise ?? null)
  const mutation = useMutation({ mutationFn: onSubmit, onSuccess: onDone })
  const seconds = exercise?.measure === 'SECONDS'

  return (
    <form
      className="space-y-3"
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
      <ExercisePicker selected={exercise} onSelect={setExercise} onClear={() => setExercise(null)} />

      {exercise && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium">{t('editor.fields.sets')}</span>
              <input name="sets" type="number" min={1} required defaultValue={existing?.sets ?? 3} className={fieldClass} />
            </label>
            {seconds ? (
              <label className="block">
                <span className="text-sm font-medium">{t('editor.fields.seconds')}</span>
                <input name="seconds" type="number" min={1} required defaultValue={existing?.seconds ?? 45} className={fieldClass} />
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-medium">{t('editor.fields.reps')}</span>
                <input name="reps" type="number" min={1} required defaultValue={existing?.reps ?? 6} className={fieldClass} />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">{t('editor.fields.rest')}</span>
              <input name="restSec" type="number" min={0} defaultValue={existing?.restSec ?? ''} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('editor.fields.intensity')}</span>
              <input name="intensityPct" type="number" min={1} max={200} defaultValue={existing?.intensityPct ?? ''} className={fieldClass} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">{t('editor.fields.note')}</span>
            <input name="note" maxLength={300} defaultValue={existing?.note ?? ''} placeholder={t('editor.fields.notePlaceholder')} className={fieldClass} />
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
          {mutation.isPending ? t('common:saving') : t('common:save')}
        </button>
        <button type="button" onClick={onCancel} className={`px-3 py-2 text-sm font-medium ${muted}`}>
          {t('common:cancel')}
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
  const { t } = useTranslation('gym')
  const mutation = useMutation({
    mutationFn: (exerciseId: string) => addAlternative(te.id, exerciseId),
    onSuccess: onDone,
  })

  return (
    <div className="space-y-3">
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
        {t('common:cancel')}
      </button>
    </div>
  )
}
