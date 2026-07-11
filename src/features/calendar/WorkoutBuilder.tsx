import type { Allure, Terrain, WorkoutNode } from './api'
import { ALLURES, ALLURE_LABEL, allureStyle } from './labels'

/**
 * Structured workout editor: blocks (allure + durée + terrain) and loops
 * (count + at least two blocks). Used to create sessions and to edit any
 * imported one — the .fit export reads exactly what is built here.
 */

export interface StepDraft {
  kind: 'step'
  allure: Allure
  value: number
  unit: 'sec' | 'min'
  terrain: Terrain
}

export interface LoopDraft {
  kind: 'loop'
  count: number
  steps: StepDraft[]
}

export type ItemDraft = StepDraft | LoopDraft

export function nodesToDrafts(nodes: WorkoutNode[]): ItemDraft[] {
  const toStep = (node: WorkoutNode): StepDraft => {
    const seconds = node.seconds ?? 600
    const useMin = seconds >= 60 && seconds % 60 === 0
    return {
      kind: 'step',
      allure: node.allure ?? 'EF',
      value: useMin ? seconds / 60 : seconds,
      unit: useMin ? 'min' : 'sec',
      terrain: node.terrain ?? 'PLAT',
    }
  }
  // loops flatten one nesting level for editing: 2×(8×[a,b]) → 16×[a,b]
  const flattenLoop = (count: number, children: WorkoutNode[]): LoopDraft => {
    const steps: StepDraft[] = []
    let totalCount = count
    for (const child of children) {
      if (child.type === 'repeat' && child.children) {
        if (children.length === 1) {
          totalCount = count * (child.count ?? 1)
          child.children.forEach((inner) => inner.type === 'step' && steps.push(toStep(inner)))
        } else {
          child.children.forEach((inner) => inner.type === 'step' && steps.push(toStep(inner)))
        }
      } else {
        steps.push(toStep(child))
      }
    }
    return { kind: 'loop', count: totalCount, steps }
  }

  return nodes.map((node) =>
    node.type === 'repeat' ? flattenLoop(node.count ?? 1, node.children ?? []) : toStep(node),
  )
}

export function draftsToNodes(items: ItemDraft[]): WorkoutNode[] {
  const stepNode = (step: StepDraft): WorkoutNode => ({
    type: 'step',
    allure: step.allure,
    seconds: step.unit === 'min' ? step.value * 60 : step.value,
    terrain: step.terrain === 'PLAT' ? null : step.terrain,
    count: null,
    children: null,
  })
  return items.map((item) =>
    item.kind === 'step'
      ? stepNode(item)
      : { type: 'repeat', allure: null, seconds: null, terrain: null, count: item.count, children: item.steps.map(stepNode) },
  )
}

/** A loop is valid with ≥ 2 blocks; a step with a positive duration. */
export function draftsError(items: ItemDraft[]): string | null {
  if (items.length === 0) return 'Ajoute au moins un bloc.'
  for (const item of items) {
    if (item.kind === 'step' && (!item.value || item.value <= 0)) {
      return 'Chaque bloc doit avoir une durée positive.'
    }
    if (item.kind === 'loop') {
      if (item.steps.length < 2) return 'Une boucle doit contenir au moins 2 blocs.'
      if (item.steps.some((s) => !s.value || s.value <= 0)) {
        return 'Chaque bloc doit avoir une durée positive.'
      }
      if (!item.count || item.count < 2) return 'Une boucle se répète au moins 2 fois.'
    }
  }
  return null
}

const newStep = (): StepDraft => ({ kind: 'step', allure: 'EF', value: 10, unit: 'min', terrain: 'PLAT' })
const newLoop = (): LoopDraft => ({
  kind: 'loop',
  count: 4,
  steps: [
    { kind: 'step', allure: 'VMA', value: 30, unit: 'sec', terrain: 'PLAT' },
    { kind: 'step', allure: 'LENTE', value: 1, unit: 'min', terrain: 'PLAT' },
  ],
})

const inputCls =
  'rounded-lg border border-moss-200 bg-moss-100 px-2 py-1 text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

export function WorkoutBuilder({
  items,
  onChange,
}: {
  items: ItemDraft[]
  onChange: (items: ItemDraft[]) => void
}) {
  function updateItem(index: number, item: ItemDraft) {
    onChange(items.map((existing, i) => (i === index ? item : existing)))
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            {item.kind === 'step' ? (
              <StepEditor step={item} onChange={(s) => updateItem(index, s)} />
            ) : (
              <LoopEditor loop={item} onChange={(l) => updateItem(index, l)} />
            )}
          </div>
          <ItemControls
            onUp={() => move(index, -1)}
            onDown={() => move(index, 1)}
            onRemove={() => remove(index)}
          />
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onChange([...items, newStep()])}
          className="rounded-lg border border-moss-200 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-moss-100 dark:border-moss-750 dark:text-linen dark:hover:bg-moss-800"
        >
          + Bloc
        </button>
        <button
          type="button"
          onClick={() => onChange([...items, newLoop()])}
          className="rounded-lg border border-moss-200 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-moss-100 dark:border-moss-750 dark:text-linen dark:hover:bg-moss-800"
        >
          + Boucle
        </button>
      </div>
    </div>
  )
}

function StepEditor({ step, onChange }: { step: StepDraft; onChange: (s: StepDraft) => void }) {
  const style = allureStyle(step.allure)
  return (
    <div
      className={`rounded-lg border border-l-4 border-moss-200 bg-moss-50 p-2 dark:border-moss-750 dark:bg-moss-800 ${style.edge}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={step.allure}
          onChange={(e) => onChange({ ...step, allure: e.target.value as Allure })}
          className={`${inputCls} font-semibold`}
          aria-label="Allure"
        >
          {ALLURES.map((a) => (
            <option key={a} value={a}>
              {ALLURE_LABEL[a]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={step.value}
          onChange={(e) => onChange({ ...step, value: Number(e.target.value) })}
          className={`${inputCls} w-16 text-right tabular-nums`}
          aria-label="Durée"
        />
        <select
          value={step.unit}
          onChange={(e) => onChange({ ...step, unit: e.target.value as 'sec' | 'min' })}
          className={inputCls}
          aria-label="Unité"
        >
          <option value="sec">sec</option>
          <option value="min">min</option>
        </select>
        <select
          value={step.terrain}
          onChange={(e) => onChange({ ...step, terrain: e.target.value as Terrain })}
          className={inputCls}
          aria-label="Terrain"
        >
          <option value="PLAT">plat</option>
          <option value="COTE">en côte</option>
          <option value="DESCENTE">en descente</option>
        </select>
      </div>
    </div>
  )
}

function LoopEditor({ loop, onChange }: { loop: LoopDraft; onChange: (l: LoopDraft) => void }) {
  function updateStep(index: number, step: StepDraft) {
    onChange({ ...loop, steps: loop.steps.map((s, i) => (i === index ? step : s)) })
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= loop.steps.length) return
    const next = [...loop.steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ ...loop, steps: next })
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
      <div className="min-w-0 flex-1 space-y-1.5 p-1.5">
        {loop.steps.map((step, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <StepEditor step={step} onChange={(s) => updateStep(index, s)} />
            </div>
            <ItemControls
              onUp={() => moveStep(index, -1)}
              onDown={() => moveStep(index, 1)}
              onRemove={
                loop.steps.length > 2
                  ? () => onChange({ ...loop, steps: loop.steps.filter((_, i) => i !== index) })
                  : undefined
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...loop, steps: [...loop.steps, newStep()] })}
          className="rounded-lg px-2 py-1 text-xs font-medium text-moss-500 transition hover:bg-moss-100 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          + Bloc dans la boucle
        </button>
      </div>
      <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-l border-moss-200 bg-moss-100 py-2 text-moss-500 dark:border-moss-750 dark:bg-moss-800 dark:text-moss-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <input
          type="number"
          min="2"
          value={loop.count}
          onChange={(e) => onChange({ ...loop, count: Number(e.target.value) })}
          className={`${inputCls} w-11 text-center font-semibold tabular-nums`}
          aria-label="Nombre de répétitions"
        />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      </div>
    </div>
  )
}

function ItemControls({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void
  onDown: () => void
  onRemove?: () => void
}) {
  const cls =
    'grid h-6 w-6 place-items-center rounded-md text-moss-400 transition hover:bg-moss-100 hover:text-ink disabled:opacity-30 dark:text-moss-500 dark:hover:bg-moss-800 dark:hover:text-linen'
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" onClick={onUp} aria-label="Monter" className={cls}>
        ↑
      </button>
      <button type="button" onClick={onDown} aria-label="Descendre" className={cls}>
        ↓
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Supprimer" className={cls}>
          ✕
        </button>
      )}
    </div>
  )
}

