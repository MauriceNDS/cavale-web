import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { ChartCard } from '../../components/chartkit'
import { muted } from '../../lib/ui'
import { fetchHub } from '../athlete/api'
import { TrendLine, type PeriodPoint } from '../athlete/charts'
import { formatMonth, formatPace } from '../athlete/labels'

type TrendMetric = 'pace' | 'hr' | 'cadence'

const pill = (active: boolean) =>
  `rounded-md px-3 py-1 text-xs font-medium transition ${
    active
      ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
      : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
  }`

/** Monthly pace / HR / cadence evolution — the descriptive performance trend. */
export function EvolutionCard({
  months,
  onOpenRange,
}: {
  months: number
  onOpenRange?: (from: string, to: string) => void
}) {
  const { t } = useTranslation('athlete')
  const { t: ts } = useTranslation('stats')
  const [metric, setMetric] = useState<TrendMetric>('pace')
  const hub = useQuery({ queryKey: ['hub'], queryFn: fetchHub })

  if (!hub.data) return null
  const periods: PeriodPoint[] = hub.data.monthly
    .slice(-Math.max(3, months))
    .map((m) => ({ ...m, key: m.month, label: formatMonth(m.month) }))

  const trend = {
    pace: {
      label: t('home.trends.avgPace'),
      value: (p: PeriodPoint) => p.avgPaceSecPerKm,
      format: (v: number) => formatPace(v),
      tick: (v: number) => formatPace(v).replace('/km', ''),
      invert: true,
    },
    hr: {
      label: t('home.trends.avgHr'),
      value: (p: PeriodPoint) => p.avgHr,
      format: (v: number) => `${Math.round(v)} bpm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
    cadence: {
      label: t('home.trends.avgCadence'),
      value: (p: PeriodPoint) => p.avgCadenceSpm,
      format: (v: number) => `${Math.round(v)} spm`,
      tick: (v: number) => `${Math.round(v)}`,
      invert: false,
    },
  }[metric]

  return (
    <ChartCard id="evolution" title={ts('evolution.title')} hint={ts('evolution.hint')}>
      <div className="mb-3 flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800 w-fit">
        <button onClick={() => setMetric('pace')} className={pill(metric === 'pace')}>
          {t('home.trends.pace')}
        </button>
        <button onClick={() => setMetric('hr')} className={pill(metric === 'hr')}>
          {t('home.trends.hr')}
        </button>
        <button onClick={() => setMetric('cadence')} className={pill(metric === 'cadence')}>
          {t('home.trends.cadence')}
        </button>
      </div>
      {metric === 'pace' && <p className={`mb-2 text-xs ${muted}`}>{t('home.trends.invertedAxis')}</p>}
      <TrendLine
        periods={periods}
        value={trend.value}
        formatValue={trend.format}
        formatTick={trend.tick}
        invert={trend.invert}
        label={trend.label}
        onSelect={
          onOpenRange &&
          ((p) =>
            onOpenRange(
              `${p.key}-01`,
              format(endOfMonth(parseISO(`${p.key}-01`)), 'yyyy-MM-dd'),
            ))
        }
      />
    </ChartCard>
  )
}
