import { useTranslation } from 'react-i18next'
import { Sparkline } from '../../components/chartkit'
import { muted } from '../../lib/ui'
import type { Acwr, RunningStatsResponse, TrainingStatusLabel } from '../athlete/api'

export const TRAINING_STATUS_STYLE: Record<TrainingStatusLabel, string> = {
  PRODUCTIVE: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  MAINTAINING: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  RECOVERY: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  OVERREACHING: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
  DETRAINING: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
}

export const ACWR_STYLE: Record<Acwr['zone'], string> = {
  UNDER: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  OPTIMAL: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  CAUTION: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
  DANGER: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
}

function VerdictCard({
  label,
  children,
  spark,
}: {
  label: string
  children: React.ReactNode
  spark?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-moss-200 bg-moss-25 px-4 py-3 dark:border-moss-750 dark:bg-moss-850">
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>{label}</p>
        {children}
      </div>
      {spark}
    </div>
  )
}

/**
 * The ten-second answer, always visible above the tabs: training status,
 * form today, ACWR with its raw loads, monotony with strain.
 */
export function VerdictStrip({ stats }: { stats: RunningStatsResponse }) {
  const { t } = useTranslation('stats')
  const status = stats.trainingStatus
  const acwr = stats.acwr
  const currentMonotony = [...stats.monotony].reverse().find((w) => w.monotony != null)

  const form = stats.form
  const today = form.at(-1)
  const weekAgo = form.at(-8)
  const formDelta =
    today && weekAgo ? Math.round((today.formScore - weekAgo.formScore) * 10) / 10 : null
  // Sparkline windows: fitness over ~8 weeks (every 2nd day), form over 6 weeks.
  const fitnessSpark = form.slice(-56).filter((_, i) => i % 2 === 0).map((d) => d.fitness)
  const formSpark = form.slice(-42).map((d) => d.formScore)

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <VerdictCard
        label={t('verdict.status')}
        spark={<Sparkline values={fitnessSpark} />}
      >
        {status ? (
          <>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TRAINING_STATUS_STYLE[status.label]}`}>
              {t(`verdict.statusLabel.${status.label}`)}
            </span>
            <p className={`mt-1 text-xs ${muted}`}>
              {t('verdict.fitnessTrend', {
                value: `${status.fitnessTrendPct > 0 ? '+' : ''}${status.fitnessTrendPct}`,
              })}
            </p>
          </>
        ) : (
          <p className="text-xl font-semibold">—</p>
        )}
      </VerdictCard>

      <VerdictCard
        label={t('verdict.form')}
        spark={<Sparkline values={formSpark} baseline={0} strokeClass="stroke-lake-600 dark:stroke-lake-300" />}
      >
        <p className="text-xl font-semibold">
          {today ? today.formScore : '—'}
          {formDelta != null && formDelta !== 0 && (
            <span className={`ml-1.5 text-xs font-medium ${formDelta > 0 ? 'text-pine-700 dark:text-pine-300' : 'text-clay-500 dark:text-clay-300'}`}>
              {formDelta > 0 ? '▲' : '▼'} {Math.abs(formDelta)}
            </span>
          )}
        </p>
        <p className={`text-xs ${muted}`}>{t('verdict.formHint')}</p>
      </VerdictCard>

      <VerdictCard label={t('verdict.acwr')}>
        <p className="text-xl font-semibold">
          {acwr.ratio.toFixed(2)}
          <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${ACWR_STYLE[acwr.zone]}`}>
            {t(`acwr.zone.${acwr.zone}`)}
          </span>
        </p>
        <p className={`text-xs ${muted}`}>
          {t('verdict.acwrLoads', {
            acute: Math.round(acwr.acute7d),
            chronic: Math.round(acwr.chronicWeeklyAvg),
          })}
        </p>
      </VerdictCard>

      <VerdictCard label={t('verdict.monotony')}>
        {currentMonotony?.monotony != null ? (
          <>
            <p className="text-xl font-semibold">
              {currentMonotony.monotony.toFixed(2)}
              {currentMonotony.flagged && (
                <span className="ml-1.5 align-middle text-xs font-semibold text-clay-500 dark:text-clay-300">⚠</span>
              )}
            </p>
            <p className={`text-xs ${muted}`}>
              {t('verdict.strain', { value: Math.round(currentMonotony.strain ?? 0) })}
            </p>
          </>
        ) : (
          <p className="text-xl font-semibold">—</p>
        )}
      </VerdictCard>
    </div>
  )
}
