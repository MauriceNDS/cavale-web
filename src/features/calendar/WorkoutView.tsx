import type { WorkoutNode } from './api'
import { ALLURE_LABEL, TERRAIN_LABEL, allureStyle, formatSeconds } from './labels'

/**
 * Read-only workout tree: allure-titled blocks, times in letters, loop
 * gutters with the repeat count — mirrors the .fit export exactly.
 */
export function WorkoutTree({ nodes }: { nodes: WorkoutNode[] }) {
  return (
    <div className="space-y-1.5">
      {nodes.map((node, index) => (
        <NodeView key={index} node={node} />
      ))}
    </div>
  )
}

function NodeView({ node }: { node: WorkoutNode }) {
  if (node.type === 'repeat') {
    return (
      <div className="flex overflow-hidden rounded-lg border border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
        <div className="min-w-0 flex-1 space-y-1.5 p-1.5">
          {(node.children ?? []).map((child, i) => (
            <NodeView key={i} node={child} />
          ))}
        </div>
        <div
          className="flex w-11 shrink-0 flex-col items-center justify-center border-l border-moss-200 bg-moss-100 text-moss-500 dark:border-moss-750 dark:bg-moss-800 dark:text-moss-400"
          title={`À répéter ${node.count} fois`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          <span className="font-display text-base font-semibold tabular-nums">{node.count}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </div>
      </div>
    )
  }

  const style = allureStyle(node.allure)
  const time = formatSeconds(node.seconds)
  const body = [
    time,
    node.allure === 'LENTE' && time ? 'de récupération' : null,
    node.terrain && node.terrain !== 'PLAT' ? TERRAIN_LABEL[node.terrain] : null,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={`rounded-lg border border-l-4 border-moss-200 bg-moss-50 px-3 py-2 dark:border-moss-750 dark:bg-moss-800 ${style.edge}`}
    >
      <p className={`text-xs font-semibold ${style.title}`}>
        {node.allure ? ALLURE_LABEL[node.allure] : 'Étape'}
      </p>
      <p className="font-display text-base font-semibold tabular-nums">{body || '—'}</p>
    </div>
  )
}
