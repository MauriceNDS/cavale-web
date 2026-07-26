import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { muted } from '../../lib/ui'
import type { ActivityStreams } from '../calendar/api'

/** Zone boundaries as fractions of heart-rate reserve (Karvonen) or %HRmax. */
const BOUNDS = [0.6, 0.7, 0.8, 0.9]

const ZONE_STYLE = [
  'bg-moss-400 dark:bg-moss-500',
  'bg-pine-600 dark:bg-pine-350',
  'bg-gold-600 dark:bg-gold-300',
  'bg-copper-600 dark:bg-copper-300',
  'bg-clay-500 dark:bg-clay-300',
]

function formatZoneTime(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/**
 * Time in HR zones for one activity, from its streams. Zones are Karvonen
 * (%HRR) when a resting HR is on the profile, %HRmax otherwise — same
 * convention as the VO2max estimate.
 */
export function ZoneBars({
  streams,
  maxHr,
  restingHr,
}: {
  streams: ActivityStreams
  maxHr: number
  restingHr: number | null
}) {
  const { t } = useTranslation('athlete')

  const zones = useMemo(() => {
    const { time, hr } = streams
    const n = Math.min(time.length, hr?.length ?? 0)
    const seconds = [0, 0, 0, 0, 0]
    const hasReserve = restingHr != null && restingHr > 0 && maxHr > restingHr
    for (let i = 1; i < n; i++) {
      const sample = hr[i]
      if (sample == null || sample <= 0) continue
      // clamp long gaps (auto-pause) so they don't inflate a zone
      const dt = Math.min(Math.max(0, time[i] - time[i - 1]), 30)
      if (dt === 0) continue
      const fraction = hasReserve ? (sample - restingHr) / (maxHr - restingHr) : sample / maxHr
      let zone = BOUNDS.findIndex((b) => fraction < b)
      if (zone === -1) zone = 4
      seconds[zone] += dt
    }
    const total = seconds.reduce((a, b) => a + b, 0)
    return { seconds, total, karvonen: hasReserve }
  }, [streams, maxHr, restingHr])

  if (zones.total < 300) return null // under 5 min of HR — nothing to read
  const maxSec = Math.max(...zones.seconds)

  return (
    <div className="mt-4 rounded-xl border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {t('activityDetail.zonesTitle')}
        </p>
        <p className={`text-[10px] ${muted}`}>
          {zones.karvonen ? t('activityDetail.zonesKarvonen') : t('activityDetail.zonesMaxHr')}
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        {[4, 3, 2, 1, 0].map((z) => {
          const sec = zones.seconds[z]
          const pct = Math.round((sec / zones.total) * 100)
          return (
            <div key={z} className="grid grid-cols-[2rem_minmax(0,1fr)_7rem] items-center gap-2 text-xs tabular-nums">
              <span className={`font-semibold ${muted}`}>Z{z + 1}</span>
              <span className="h-3.5 overflow-hidden rounded-full bg-moss-100 dark:bg-moss-800">
                <span
                  className={`block h-full rounded-full ${ZONE_STYLE[z]}`}
                  style={{ width: `${maxSec > 0 ? Math.max(sec > 0 ? 2 : 0, (sec / maxSec) * 100) : 0}%` }}
                  aria-hidden
                />
              </span>
              <span className={`text-right ${muted}`}>
                {sec > 0 ? `${formatZoneTime(sec)} · ${pct}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
