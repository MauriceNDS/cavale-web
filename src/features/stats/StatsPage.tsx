import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { parseISO, subMonths } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { muted } from '../../lib/ui'
import { ChartCard } from '../../components/chartkit'
import { fetchRunningStats, type RunningStatsResponse } from '../athlete/api'
import { useAuth } from '../auth/session'
import { GymStatsSection } from '../gym/GymStatsSection'
import {
  CheckpointsTable,
  CriticalPaceStat,
  DurabilityChart,
  EffortBandChart,
  EffortStatus,
  EfficiencyChart,
  FormChart,
  MonotonyChart,
  Vo2maxChart,
  VolumeChart,
  VolumeTotals,
} from './charts'
import { EvolutionCard } from './EvolutionCard'
import { RecordsTab } from './RecordsTab'
import { VerdictStrip } from './VerdictStrip'

const RANGES = [1, 3, 6, 12] as const
type RangeMonths = (typeof RANGES)[number]

const TABS = ['charge', 'volume', 'physio', 'records', 'renfo'] as const
type StatsTab = (typeof TABS)[number]
/** Tabs whose charts obey the period selector. */
const PERIOD_TABS: StatsTab[] = ['charge', 'volume', 'physio']

function resolveTab(raw: string | undefined, gymEnabled: boolean): StatsTab {
  if (raw === 'renfo') return gymEnabled ? 'renfo' : 'charge'
  if (raw === 'course') return 'charge' // legacy deep links
  return (TABS as readonly string[]).includes(raw ?? '') ? (raw as StatsTab) : 'charge'
}

const pill = (active: boolean) =>
  `rounded-md px-3 py-1 text-sm font-medium transition ${
    active
      ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
      : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
  }`

/** The statistics home: verdict strip on top, one thematic tab row below. */
export function StatsPage() {
  const { t } = useTranslation('stats')
  const search = useSearch({ strict: false }) as { tab?: string }
  const navigate = useNavigate()
  const gymEnabled = useAuth().user?.gymEnabled ?? true
  const tab = resolveTab(search.tab, gymEnabled)
  const [months, setMonths] = useState<RangeMonths>(3)

  const query = useQuery({ queryKey: ['running-stats'], queryFn: fetchRunningStats })
  const stats = query.data

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  if (!stats) {
    return <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('loadError')}</p>
  }

  const tabs: StatsTab[] = gymEnabled ? [...TABS] : TABS.filter((v) => v !== 'renfo')

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 pb-10">
      <h1 className="font-display text-2xl font-semibold">{t('title')}</h1>

      <VerdictStrip stats={stats} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {tabs.map((value) => (
            <button
              key={value}
              onClick={() => void navigate({ to: '/stats', search: { tab: value } })}
              aria-pressed={tab === value}
              className={pill(tab === value)}
            >
              {t(`tabs.${value}`)}
            </button>
          ))}
        </div>
        {PERIOD_TABS.includes(tab) && (
          <div className="ml-auto flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setMonths(r)}
                aria-pressed={months === r}
                className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${
                  months === r
                    ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
                    : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
                }`}
              >
                {t('months', { count: r })}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'charge' && <ChargeTab stats={stats} months={months} />}
      {tab === 'volume' && <VolumeTab stats={stats} months={months} />}
      {tab === 'physio' && <PhysioTab stats={stats} months={months} />}
      {tab === 'records' && <RecordsTab stats={stats} />}
      {tab === 'renfo' && <GymStatsSection />}
    </div>
  )
}

/* ── Tab bodies ────────────────────────────────────────────────────── */

interface TabProps {
  stats: RunningStatsResponse
  months: RangeMonths
}

function useCutoff(months: RangeMonths) {
  return useMemo(() => subMonths(new Date(), months), [months])
}

function ChargeTab({ stats, months }: TabProps) {
  const { t } = useTranslation('stats')
  const cutoff = useCutoff(months)
  const inRange = (date: string) => parseISO(date) >= cutoff
  const form = stats.form.filter((d) => inRange(d.date))
  const effort = stats.weeklyEffort.filter((w) => inRange(w.weekStart))
  const monotony = stats.monotony.filter((w) => inRange(w.weekStart))
  const currentEffort = stats.weeklyEffort.at(-1)

  return (
    <div className="space-y-4">
      <ChartCard
        id="form"
        title={t('form.title')}
        hint={t('form.hint')}
        summary={stats.form.length > 0 ? t('form.summary', { value: stats.form.at(-1)!.formScore }) : undefined}
      >
        <FormChart days={form} />
      </ChartCard>

      <ChartCard
        id="effort"
        title={t('effort.title')}
        hint={t('effort.hint')}
        summary={currentEffort ? t('effort.summary', { value: currentEffort.effort }) : undefined}
      >
        <EffortBandChart weeks={effort} />
        <EffortStatus weeks={stats.weeklyEffort} />
      </ChartCard>

      {stats.monotony.some((w) => w.monotony != null) && (
        <ChartCard id="monotony" title={t('monotony.title')} hint={t('monotony.hint')}>
          <MonotonyChart weeks={monotony} />
        </ChartCard>
      )}
    </div>
  )
}

function VolumeTab({ stats, months }: TabProps) {
  const { t } = useTranslation('stats')
  const cutoff = useCutoff(months)
  const volume = stats.weeklyVolume.filter((w) => parseISO(w.weekStart) >= cutoff)
  const totalKm = Math.round(volume.reduce((sum, w) => sum + Number(w.distanceKm), 0))

  return (
    <div className="space-y-4">
      <ChartCard
        id="volume"
        title={t('volume.title')}
        hint={t('volume.hint')}
        summary={t('volume.summary', { km: totalKm })}
      >
        <VolumeChart weeks={volume} />
        <VolumeTotals weeks={volume} />
      </ChartCard>
    </div>
  )
}

function PhysioTab({ stats, months }: TabProps) {
  const { t } = useTranslation('stats')
  const cutoff = useCutoff(months)
  const efficiency = stats.efficiency.slice(-months)
  const vo2max = stats.vo2maxTrend.slice(-months)
  const durability = stats.durability.filter((p) => parseISO(p.date) >= cutoff)
  const currentVo2 = [...stats.vo2maxTrend].reverse().find((m) => m.vo2max != null)

  return (
    <div className="space-y-4">
      {(stats.vo2maxTrend.some((m) => m.vo2max != null) || stats.criticalPace) && (
        <ChartCard
          id="vo2max"
          title={t('vo2max.title')}
          hint={t('vo2max.hint')}
          summary={currentVo2 ? t('vo2max.summary', { value: currentVo2.vo2max }) : undefined}
        >
          {stats.vo2maxTrend.some((m) => m.vo2max != null) && <Vo2maxChart months={vo2max} />}
          {stats.criticalPace && <CriticalPaceStat cp={stats.criticalPace} />}
        </ChartCard>
      )}

      {efficiency.some((m) => m.metersPerBeat != null) && (
        <ChartCard id="efficiency" title={t('efficiency.title')} hint={t('efficiency.hint')}>
          <EfficiencyChart months={efficiency} />
        </ChartCard>
      )}

      {stats.durability.length > 0 && (
        <ChartCard id="durability" title={t('durability.title')} hint={t('durability.hint')}>
          <DurabilityChart points={durability} />
        </ChartCard>
      )}

      <EvolutionCard months={months} />

      {stats.checkpoints.length > 0 && (
        <ChartCard id="checkpoints" title={t('checkpoints.title')} hint={t('checkpoints.hint')}>
          <CheckpointsTable checkpoints={stats.checkpoints} />
        </ChartCard>
      )}
    </div>
  )
}
