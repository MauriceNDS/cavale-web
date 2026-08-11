import { useTranslation } from 'react-i18next'
import type { PaceContextResponse, WorkoutNode } from './api'
import { allureHrBand, allureLabel, allurePaceBand, terrainLabel, allureStyle, formatSeconds } from './labels'

/**
 * Read-only workout tree: allure-titled blocks, times in letters, loop
 * gutters with the repeat count — mirrors the .fit export exactly.
 * With a road pace context, each block also shows its derived pace band.
 */
export function WorkoutTree({ nodes, pace }: { nodes: WorkoutNode[]; pace?: PaceContextResponse | null }) {
  return (
    <div className="space-y-1.5">
      {nodes.map((node, index) => (
        <NodeView key={index} node={node} pace={pace} />
      ))}
    </div>
  )
}

function NodeView({ node, pace }: { node: WorkoutNode; pace?: PaceContextResponse | null }) {
  const { t } = useTranslation('calendar')
  if (node.type === 'repeat') {
    return (
      <div className="flex overflow-hidden rounded-lg border border-moss-200 bg-moss-25 dark:border-moss-750 dark:bg-moss-850">
        <div className="min-w-0 flex-1 space-y-1.5 p-1.5">
          {(node.children ?? []).map((child, i) => (
            <NodeView key={i} node={child} pace={pace} />
          ))}
        </div>
        <div
          className="flex w-11 shrink-0 flex-col items-center justify-center border-l border-moss-200 bg-moss-100 text-moss-500 dark:border-moss-750 dark:bg-moss-800 dark:text-moss-400"
          title={t('workout.repeatTimes', { count: node.count ?? 0 })}
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
    node.allure === 'LENTE' && time ? t('workout.recovery') : null,
    node.terrain && node.terrain !== 'PLAT' ? terrainLabel(node.terrain) : null,
  ]
    .filter(Boolean)
    .join(' ')
  const band = node.allure && node.allure !== 'LENTE' ? allurePaceBand(pace, node.allure) : null
  const hrBand = node.allure && node.allure !== 'LENTE' ? allureHrBand(pace, node.allure) : null
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-l-4 border-moss-200 bg-moss-50 px-3 py-2 dark:border-moss-750 dark:bg-moss-800 ${style.edge}`}
    >
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${style.title}`}>
          {node.allure ? allureLabel(node.allure) : t('workout.step')}
        </p>
        <p className="font-display text-base font-semibold tabular-nums">{body || '—'}</p>
      </div>
      {band && (
        <div className="shrink-0 text-right">
          {band.goal && (
            <p className="text-[10px] font-semibold tracking-wide text-copper-600 uppercase dark:text-copper-300">
              {t('workout.goalPace')}
            </p>
          )}
          <p className="text-xs font-medium text-moss-500 tabular-nums dark:text-moss-400">
            {band.label}
          </p>
          {hrBand && (
            <p className="text-[11px] text-moss-400 tabular-nums dark:text-moss-500">{hrBand}</p>
          )}
        </div>
      )}
    </div>
  )
}
