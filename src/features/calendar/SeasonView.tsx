import { useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { ProgressRing, RING_COLORS } from '../../components/ProgressRing'
import { muted } from '../../lib/ui'
import { formatDuration, WEEK_TYPE_BADGE, WEEK_TYPE_EDGE, weekTypeLabel } from './labels'
import type { PlanProgressResponse, WeekProgress } from '../objective/api'

/**
 * The whole season at a glance: one row per plan week, the week type carried
 * by its badge and left edge (shock/deload/taper jump out), and completion
 * rings for volume, time and D+. Tapping a row opens that week in the
 * planning. The current week is highlighted and scrolled into view.
 */
export function SeasonView({
  progress,
  onPickWeek,
}: {
  progress: PlanProgressResponse
  onPickWeek: (startDate: string) => void
}) {
  const currentRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <ul className="mt-4 space-y-2">
      {progress.weeks.map((week) => (
        <li key={week.weekId} ref={week.current ? currentRef : undefined}>
          <SeasonWeekRow week={week} onPick={() => onPickWeek(week.startDate)} />
        </li>
      ))}
    </ul>
  )
}

/** Whole kilometres once there are enough of them — a ring centre has no room
 *  for a decimal that stops mattering above 10 km. */
function compactKm(km: number): string {
  return km >= 10 ? String(Math.round(km)) : String(Math.round(km * 10) / 10)
}

function SeasonWeekRow({ week, onPick }: { week: WeekProgress; onPick: () => void }) {
  const { t } = useTranslation('calendar')

  const volumeTarget = week.estimatedVolumeKm ?? week.targetVolumeKm
  const rings = [
    volumeTarget != null &&
      volumeTarget > 0 && {
        key: 'volume' as const,
        label: t('header.metrics.volume'),
        ratio: week.actualVolumeKm / volumeTarget,
        center: { value: compactKm(week.actualVolumeKm), detail: `/ ${volumeTarget} km` },
        title: `${Math.round(week.actualVolumeKm * 10) / 10}/${volumeTarget} km`,
      },
    week.plannedDurationMin != null &&
      week.plannedDurationMin > 0 && {
        key: 'time' as const,
        label: t('header.metrics.time'),
        ratio: week.actualDurationMin / week.plannedDurationMin,
        center: {
          value: formatDuration(week.actualDurationMin) ?? '0',
          detail: `/ ${formatDuration(week.plannedDurationMin)}`,
        },
        title: `${formatDuration(week.actualDurationMin) ?? '0'}/${formatDuration(week.plannedDurationMin)}`,
      },
    week.targetElevationM != null &&
      week.targetElevationM > 0 && {
        key: 'elevation' as const,
        label: t('header.metrics.elevation'),
        ratio: week.actualElevationM / week.targetElevationM,
        center: {
          value: String(week.actualElevationM),
          detail: `/ ${week.targetElevationM} m`,
        },
        title: `${week.actualElevationM}/${week.targetElevationM} m`,
      },
  ].filter(Boolean) as {
    key: keyof typeof RING_COLORS
    label: string
    ratio: number
    center: { value: string; detail: string }
    title: string
  }[]

  return (
    <button
      onClick={onPick}
      className={`flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-l-4 p-3 text-left transition ${
        week.current
          ? 'border-pine-600 bg-pine-100/50 dark:border-pine-350 dark:bg-pine-900/30'
          : 'border-moss-200 bg-moss-25 hover:bg-moss-50 dark:border-moss-750 dark:bg-moss-850 dark:hover:bg-moss-800'
      } ${WEEK_TYPE_EDGE[week.weekType]}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold">
            {t('header.weekShort', { num: week.weekNumber })}
          </span>
          <span className={`text-xs ${muted}`}>
            {format(parseISO(week.startDate), 'd MMM', { locale: dateLocale() })}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${WEEK_TYPE_BADGE[week.weekType]}`}
          >
            {weekTypeLabel(week.weekType)}
          </span>
          {week.current && (
            <span className="rounded-full bg-pine-600 px-2 py-0.5 text-[11px] font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950">
              {t('season.currentWeek')}
            </span>
          )}
        </div>
        {week.phase && <p className={`mt-0.5 truncate text-xs ${muted}`}>{week.phase}</p>}
        {week.sessionsPlanned > 0 && (
          <p className={`mt-0.5 text-xs tabular-nums ${muted}`}>
            {t('season.sessions', { done: week.sessionsDone, planned: week.sessionsPlanned })}
          </p>
        )}
      </div>
      {/* Actual values need room to stay legible, so on a phone the rings drop
          to their own full-width row rather than squeezing the week's title. */}
      {rings.length > 0 && (
        <div className="flex w-full shrink-0 justify-around gap-2.5 md:w-auto md:justify-end">
          {rings.map((ring) => (
            <ProgressRing
              key={ring.key}
              ratio={ring.ratio}
              size={56}
              strokeWidth={4}
              label={ring.label}
              center={ring.center}
              title={ring.title}
              className={RING_COLORS[ring.key]}
            />
          ))}
        </div>
      )}
    </button>
  )
}
