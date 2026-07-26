import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import {
  bandX,
  ChartCard,
  ChartSurface,
  gappedLinePath,
  GridY,
  linearY,
  niceTicks,
  pointX,
  roundedTopBar,
  TooltipLines,
  XLabels,
} from '../../components/chartkit'
import {
  fetchGymStats,
  type ExerciseTrend,
  type MuscleVolume,
  type WeekAdherence,
  type WeekTonnage,
} from './api'
import { CATEGORY_BADGE, muscleLabel } from './labels'

/** Tonnes read better than five-figure kilo counts. */
function tonnes(kg: number): string {
  return kg >= 1000 ? `${(Math.round(kg / 100) / 10).toFixed(1)} t` : `${Math.round(kg)} kg`
}

/** Gym progression: 1RM trends, volume, balance, fresh PRs, adherence. */
export function GymStatsSection() {
  const { t } = useTranslation('gym')
  const query = useQuery({ queryKey: ['gym-stats'], queryFn: fetchGymStats })

  if (query.isLoading) {
    return <p className={`mt-10 text-center ${muted}`}>{t('common:loading')}</p>
  }
  const stats = query.data
  if (!stats) {
    return (
      <p className="mt-10 text-center text-clay-500 dark:text-clay-300">{t('stats.loadError')}</p>
    )
  }

  const hasData = stats.weeklyTonnage.some((w) => w.sets > 0)

  return (
    <div className="space-y-3">
      {!hasData && <p className={`mt-10 text-center ${muted}`}>{t('stats.empty')}</p>}

      {stats.prWall.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">{t('stats.recentPrs')}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {stats.prWall.map((pr) => (
              <Link
                key={`${pr.exerciseId}-${pr.reps}`}
                to="/renfo/exercices/$exerciseId"
                params={{ exerciseId: pr.exerciseId }}
                className="rounded-lg border border-copper-600/30 bg-copper-600/5 p-3 transition hover:border-copper-600 dark:border-copper-300/30 dark:bg-copper-300/10 dark:hover:border-copper-300"
              >
                <p className="font-medium">
                  {pr.exerciseName} × {pr.reps}
                </p>
                <p className="mt-0.5 text-xl font-semibold text-copper-600 dark:text-copper-300">
                  {pr.weightKg} kg
                  {pr.previousKg != null && (
                    <span className="ml-1.5 text-sm font-medium">
                      (+{Math.round((pr.weightKg - pr.previousKg) * 10) / 10})
                    </span>
                  )}
                </p>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {t('stats.prDate', {
                    date: format(parseISO(pr.date), 'd MMMM', { locale: dateLocale() }),
                  })}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stats.oneRmTrends.length > 0 && <OneRmSection trends={stats.oneRmTrends} />}
      {hasData && <VolumeSection weeks={stats.weeklyTonnage} adherence={stats.adherence} />}
      {stats.muscleVolume.length > 0 && <BalanceSection volumes={stats.muscleVolume} />}
    </div>
  )
}

/* ── Estimated 1RM, reserve-adjusted ───────────────────────────────── */

function OneRmSection({ trends }: { trends: ExerciseTrend[] }) {
  const { t } = useTranslation('gym')
  const [selected, setSelected] = useState(trends[0].exerciseId)
  const trend = trends.find((x) => x.exerciseId === selected) ?? trends[0]
  const points = trend.points
  const current = points.at(-1)

  return (
    <ChartCard
      id="gym-1rm"
      title={t('stats.oneRmTitle')}
      hint={t('stats.oneRmHint')}
      summary={
        current ? (
          <span className="font-semibold text-copper-600 tabular-nums dark:text-copper-300">
            {current.estOneRmKg} kg
          </span>
        ) : null
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {trends.map((x) => (
          <button
            key={x.exerciseId}
            onClick={() => setSelected(x.exerciseId)}
            aria-pressed={x.exerciseId === selected}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${CATEGORY_BADGE[x.category]} ${
              x.exerciseId === selected ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {x.name}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <p className={`py-6 text-center text-sm ${muted}`}>{t('stats.empty')}</p>
      ) : (
        <ChartSurface
          ariaLabel={t('stats.oneRmAria', { name: trend.name })}
          count={points.length}
          crosshair
          xFor={(i, frame) => pointX(frame, points.length)(i)}
          tooltip={(i) => (
            <TooltipLines
              lines={[
                format(parseISO(points[i].date), 'd MMMM yyyy', { locale: dateLocale() }),
                t('stats.oneRmValue', { value: points[i].estOneRmKg }),
                t('stats.topSet', { value: points[i].bestWeightKg }),
              ]}
            />
          )}
        >
          {(frame) => {
            const values = points.map((p) => p.estOneRmKg)
            const lo = Math.min(...values) * 0.95
            const hi = Math.max(...values) * 1.05 || 1
            const y = linearY(frame, lo, hi)
            const x = pointX(frame, points.length)
            return (
              <>
                <GridY frame={frame} ticks={niceTicks(hi).filter((v) => v > lo && v < hi)} y={y} />
                <path
                  d={gappedLinePath(x, y, points.map((p) => p.estOneRmKg))}
                  fill="none"
                  strokeWidth={2}
                  className="stroke-copper-600 dark:stroke-copper-300"
                />
                {points.map((p, i) => (
                  <circle
                    key={p.date}
                    cx={x(i)}
                    cy={y(p.estOneRmKg)}
                    r={3}
                    className="fill-copper-600 dark:fill-copper-300"
                  />
                ))}
                <XLabels
                  frame={frame}
                  count={points.length}
                  x={x}
                  step={Math.max(1, Math.ceil(points.length / 4))}
                  label={(i) => format(parseISO(points[i].date), 'd MMM', { locale: dateLocale() })}
                />
              </>
            )
          }}
        </ChartSurface>
      )}

      <Link
        to="/renfo/exercices/$exerciseId"
        params={{ exerciseId: trend.exerciseId }}
        className="mt-2 inline-block text-xs font-medium text-pine-700 underline dark:text-pine-300"
      >
        {t('stats.openHistory', { name: trend.name })}
      </Link>
    </ChartCard>
  )
}

/* ── Volume, in the three currencies strength work actually has ────── */

function VolumeSection({
  weeks,
  adherence,
}: {
  weeks: WeekTonnage[]
  adherence: WeekAdherence[]
}) {
  const { t } = useTranslation('gym')
  const planned = adherence.reduce((sum, w) => sum + w.plannedGym, 0)
  const done = adherence.reduce((sum, w) => sum + w.doneGym, 0)
  const current = weeks.at(-1)

  return (
    <ChartCard
      id="gym-volume"
      title={t('stats.tonnageTitle')}
      hint={t('stats.tonnageHint')}
      summary={
        current ? <span className="font-semibold tabular-nums">{tonnes(current.tonnageKg)}</span> : null
      }
    >
      <ChartSurface
        ariaLabel={t('stats.tonnageAria')}
        count={weeks.length}
        tooltip={(i) => (
          <TooltipLines
            lines={[
              t('stats.weekOf', {
                date: format(parseISO(weeks[i].weekStart), 'd MMMM', { locale: dateLocale() }),
              }),
              weeks[i].tonnageKg > 0
                ? t('stats.tonnageValue', { value: tonnes(weeks[i].tonnageKg) })
                : null,
              t('stats.hardSets', { count: weeks[i].sets }),
              weeks[i].secondsUnderTension > 0
                ? t('stats.tension', { min: Math.round(weeks[i].secondsUnderTension / 60) })
                : null,
            ]}
          />
        )}
      >
        {(frame) => {
          const hi = Math.max(...weeks.map((w) => w.tonnageKg), 1) * 1.1
          const y = linearY(frame, 0, hi)
          const { band, left } = bandX(frame, weeks.length)
          return (
            <>
              <GridY frame={frame} ticks={niceTicks(hi)} y={y} />
              {weeks.map((week, i) => (
                <path
                  key={week.weekStart}
                  d={roundedTopBar(
                    left(i) + band * 0.2,
                    y(week.tonnageKg),
                    band * 0.6,
                    Math.max(week.tonnageKg > 0 ? 2 : 0, y(0) - y(week.tonnageKg)),
                  )}
                  className="fill-copper-600 dark:fill-copper-300"
                />
              ))}
              <XLabels
                frame={frame}
                count={weeks.length}
                x={(i) => left(i) + band / 2}
                step={4}
                label={(i) => format(parseISO(weeks[i].weekStart), 'd MMM', { locale: dateLocale() })}
              />
            </>
          )
        }}
      </ChartSurface>

      {/* kilos are blind to bodyweight and timed work — say the rest out loud */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Tally
          value={String(weeks.reduce((s, w) => s + w.sets, 0))}
          label={t('stats.hardSetsShort')}
        />
        <Tally
          value={`${Math.round(weeks.reduce((s, w) => s + w.secondsUnderTension, 0) / 60)} min`}
          label={t('stats.tensionShort')}
        />
        <Tally value={planned > 0 ? `${done}/${planned}` : '—'} label={t('stats.adherenceShort')} />
      </div>
    </ChartCard>
  )
}

function Tally({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-moss-100 px-2 py-2 text-center dark:bg-moss-800">
      <p className="font-display text-base font-semibold tabular-nums">{value}</p>
      <p className={`text-[11px] ${muted}`}>{label}</p>
    </div>
  )
}

/* ── Where the volume lands ────────────────────────────────────────── */

function BalanceSection({ volumes }: { volumes: MuscleVolume[] }) {
  const { t } = useTranslation('gym')
  const max = Math.max(...volumes.map((v) => v.sets), 1)
  return (
    <ChartCard id="gym-balance" title={t('stats.balanceTitle')} hint={t('stats.balanceHint')}>
      <div className="space-y-1.5">
        {volumes.map((volume) => (
          <div key={volume.muscle} className="flex items-center gap-2">
            <span className={`w-28 shrink-0 text-xs ${muted}`}>{muscleLabel(volume.muscle)}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-moss-100 dark:bg-moss-800">
              <div
                className="h-full rounded bg-copper-600 dark:bg-copper-300"
                style={{ width: `${(volume.sets / max) * 100}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums">
              {t('stats.sets', { count: volume.sets })}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
