import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RenfoTabs } from './RenfoTabs'
import {
  fetchGymStats,
  type ExerciseTrend,
  type MuscleVolume,
  type WeekTonnage,
} from './api'
import { CATEGORY_BADGE, MUSCLE_LABEL } from './labels'

const muted = 'text-moss-500 dark:text-moss-400'
const card = 'rounded-xl border border-moss-200 bg-moss-25 p-5 dark:border-moss-750 dark:bg-moss-850'

/** Gym progression: 1RM trends, tonnage, balance, fresh PRs, adherence. */
export function StatsPage() {
  const query = useQuery({ queryKey: ['gym-stats'], queryFn: fetchGymStats })

  if (query.isLoading) {
    return (
      <div className="mx-auto mt-6 max-w-3xl">
        <RenfoTabs active="stats" />
        <p className={`mt-10 text-center ${muted}`}>Chargement…</p>
      </div>
    )
  }
  const stats = query.data
  if (!stats) {
    return (
      <div className="mx-auto mt-6 max-w-3xl">
        <RenfoTabs active="stats" />
        <p className="mt-10 text-center text-clay-500 dark:text-clay-300">
          Impossible de charger les statistiques.
        </p>
      </div>
    )
  }

  const hasData = stats.weeklyTonnage.some((w) => w.sets > 0)

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 pb-10">
      <RenfoTabs active="stats" />

      {!hasData && (
        <p className={`mt-10 text-center ${muted}`}>
          Termine ta première séance de renfo pour voir ta progression ici.
        </p>
      )}

      {stats.prWall.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Records récents</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {stats.prWall.map((pr) => (
              <div
                key={`${pr.exerciseId}-${pr.reps}`}
                className="rounded-lg border border-copper-600/30 bg-copper-600/5 p-3 dark:border-copper-300/30 dark:bg-copper-300/10"
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
                  le {format(parseISO(pr.date), 'd MMMM', { locale: fr })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.oneRmTrends.length > 0 && <OneRmSection trends={stats.oneRmTrends} />}

      {hasData && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Tonnage hebdomadaire</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Poids total soulevé (kg × reps), 16 dernières semaines.
          </p>
          <div className="mt-3">
            <TonnageBars weeks={stats.weeklyTonnage} />
          </div>
          <AdherenceLine adherence={stats.adherence} />
        </section>
      )}

      {stats.muscleVolume.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold">Équilibre musculaire</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>
            Séries par groupe musculaire, 8 dernières semaines — surveille le ratio
            quadriceps / ischios.
          </p>
          <div className="mt-3 space-y-1.5">
            <MuscleBars volumes={stats.muscleVolume} />
          </div>
        </section>
      )}
    </div>
  )
}

/* ── 1RM trend (estimated, Epley) ──────────────────────────────────── */

function OneRmSection({ trends }: { trends: ExerciseTrend[] }) {
  const [selected, setSelected] = useState(trends[0].exerciseId)
  const trend = trends.find((t) => t.exerciseId === selected) ?? trends[0]

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">1RM estimé</h2>
        <div className="flex flex-wrap gap-1.5">
          {trends.map((t) => (
            <button
              key={t.exerciseId}
              onClick={() => setSelected(t.exerciseId)}
              aria-pressed={t.exerciseId === selected}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${CATEGORY_BADGE[t.category]} ${
                t.exerciseId === selected ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <p className={`mt-0.5 text-xs ${muted}`}>
        Formule d'Epley d'après tes séries — une estimation, pas un test de force.
      </p>
      <div className="mt-3">
        <OneRmLine trend={trend} />
      </div>
    </section>
  )
}

const W = 640
const H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 44 }

function OneRmLine({ trend }: { trend: ExerciseTrend }) {
  const points = trend.points
  if (points.length === 0) return null
  const values = points.map((p) => p.estOneRmKg)
  const lo = Math.min(...values) * 0.95
  const hi = Math.max(...values) * 1.05 || 1
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD.left + (i * (W - PAD.left - PAD.right)) / (points.length - 1)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.estOneRmKg)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`1RM estimé — ${trend.name}`}>
      {[...new Set([lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75])].map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
            className="stroke-moss-200 dark:stroke-moss-750" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end"
            className="fill-moss-500 text-[10px] dark:fill-moss-400">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" strokeWidth={2}
        className="stroke-copper-600 dark:stroke-copper-300" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.estOneRmKg)} r={3.5}
            className="fill-copper-600 dark:fill-copper-300" />
          {(i === 0 || i === points.length - 1) && (
            <text x={x(i)} y={y(p.estOneRmKg) - 8} textAnchor="middle"
              className="fill-ink text-[10px] font-semibold dark:fill-linen">
              {p.estOneRmKg} kg
            </text>
          )}
          {(i === 0 || i === points.length - 1 || points.length <= 6) && (
            <text x={x(i)} y={H - 8} textAnchor="middle"
              className="fill-moss-500 text-[10px] dark:fill-moss-400">
              {format(parseISO(p.date), 'd MMM', { locale: fr })}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/* ── Weekly tonnage bars ───────────────────────────────────────────── */

function TonnageBars({ weeks }: { weeks: WeekTonnage[] }) {
  const max = Math.max(...weeks.map((w) => w.tonnageKg), 1)
  const barW = (W - PAD.left - PAD.right) / weeks.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label="Tonnage hebdomadaire">
      {weeks.map((week, i) => {
        const h = (week.tonnageKg / max) * (H - PAD.top - PAD.bottom)
        const bx = PAD.left + i * barW + barW * 0.15
        return (
          <g key={week.weekStart}>
            <rect x={bx} y={H - PAD.bottom - h} width={barW * 0.7} height={Math.max(h, 1)}
              rx={3} className={week.tonnageKg > 0
                ? 'fill-copper-600 dark:fill-copper-300'
                : 'fill-moss-200 dark:fill-moss-750'} />
            {week.tonnageKg > 0 && h > 18 && (
              <text x={bx + barW * 0.35} y={H - PAD.bottom - h - 4} textAnchor="middle"
                className="fill-moss-500 text-[9px] dark:fill-moss-400">
                {week.tonnageKg >= 1000
                  ? `${Math.round(week.tonnageKg / 100) / 10}t`
                  : week.tonnageKg}
              </text>
            )}
            {i % 4 === 0 && (
              <text x={bx + barW * 0.35} y={H - 8} textAnchor="middle"
                className="fill-moss-500 text-[10px] dark:fill-moss-400">
                {format(parseISO(week.weekStart), 'd MMM', { locale: fr })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function AdherenceLine({ adherence }: { adherence: { plannedGym: number; doneGym: number }[] }) {
  const planned = adherence.reduce((sum, w) => sum + w.plannedGym, 0)
  const done = adherence.reduce((sum, w) => sum + w.doneGym, 0)
  if (planned === 0) return null
  return (
    <p className={`mt-2 text-sm ${muted}`}>
      Assiduité : <span className="font-semibold text-ink dark:text-linen">{done}/{planned}</span>{' '}
      séances renfo réalisées sur les 8 dernières semaines.
    </p>
  )
}

/* ── Muscle balance (horizontal bars) ──────────────────────────────── */

function MuscleBars({ volumes }: { volumes: MuscleVolume[] }) {
  const max = Math.max(...volumes.map((v) => v.sets), 1)
  return (
    <>
      {volumes.map((volume) => (
        <div key={volume.muscle} className="flex items-center gap-2">
          <span className={`w-28 shrink-0 text-xs ${muted}`}>{MUSCLE_LABEL[volume.muscle]}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-moss-100 dark:bg-moss-800">
            <div
              className="h-full rounded bg-copper-600 dark:bg-copper-300"
              style={{ width: `${(volume.sets / max) * 100}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums">
            {volume.sets} série{volume.sets > 1 ? 's' : ''}
          </span>
        </div>
      ))}
    </>
  )
}
