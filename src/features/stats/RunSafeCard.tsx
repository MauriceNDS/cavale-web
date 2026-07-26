import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import type { LongRunGuard } from '../athlete/api'

const BAND_CHIP: Record<NonNullable<LongRunGuard['lastRunBand']>, string> = {
  NORMAL: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  ELEVATED: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
  HIGH: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
}

/**
 * RUNSAFE long-run guard (BJSM 2025): the distance scale where the next
 * long run's injury hazard steps up — up to 1.3× the trailing-30-day
 * longest is normal, 1.3–2× costs +52 % hazard, beyond 2× costs +128 %.
 */
export function RunSafeCard({ guard }: { guard: LongRunGuard }) {
  const { t } = useTranslation('stats')
  const domain = guard.highFromKm * 1.2
  const pct = (km: number) => `${Math.min(100, (km / domain) * 100)}%`

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('runsafe.title')}</h2>
        {guard.lastRunKm != null && guard.lastRunBand && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BAND_CHIP[guard.lastRunBand]}`}>
            {t('runsafe.lastRun', { km: guard.lastRunKm })} · {t(`runsafe.band.${guard.lastRunBand}`)}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-xs ${muted}`}>{t('runsafe.hint')}</p>

      <div className="relative mt-5 mb-6">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          <div className="bg-pine-600 dark:bg-pine-350" style={{ width: pct(guard.elevatedFromKm) }} />
          <div
            className="bg-gold-600 dark:bg-gold-300"
            style={{ width: `${((guard.highFromKm - guard.elevatedFromKm) / domain) * 100}%` }}
          />
          <div className="flex-1 bg-clay-500 dark:bg-clay-300" />
        </div>
        {/* trailing-30-day longest, the anchor of the scale */}
        <div className="absolute -top-1 h-4 w-0.5 bg-ink dark:bg-linen" style={{ left: pct(guard.recentLongestKm) }} />
        <p
          className={`absolute top-4 -translate-x-1/2 text-[10px] whitespace-nowrap ${muted}`}
          style={{ left: pct(guard.recentLongestKm) }}
        >
          {t('runsafe.longest', { km: guard.recentLongestKm })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className={`text-xs ${muted}`}>{t('runsafe.safeUpTo')}</p>
          <p className="mt-0.5 font-semibold text-pine-700 dark:text-pine-300">
            ≤ {guard.elevatedFromKm} km
          </p>
        </div>
        <div>
          <p className={`text-xs ${muted}`}>{t('runsafe.elevated')}</p>
          <p className="mt-0.5 font-semibold text-gold-600 dark:text-gold-300">
            {guard.elevatedFromKm}–{guard.highFromKm} km
          </p>
        </div>
        <div>
          <p className={`text-xs ${muted}`}>{t('runsafe.high')}</p>
          <p className="mt-0.5 font-semibold text-clay-500 dark:text-clay-300">
            &gt; {guard.highFromKm} km
          </p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${muted}`}>
        {t('runsafe.basis', {
          km: guard.recentLongestKm,
          date: format(parseISO(guard.longestOn), 'd MMMM', { locale: dateLocale() }),
        })}
      </p>
    </section>
  )
}
