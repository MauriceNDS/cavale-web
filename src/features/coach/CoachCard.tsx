import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { fetchInsights } from './api'

/**
 * Home teaser for the latest weekly review: first lines of the prose and the
 * pending-proposal count — the full review and the approve/dismiss flow live
 * on the Coach page.
 */
export function CoachCard() {
  const { t } = useTranslation('coach')
  const insights = useQuery({ queryKey: ['coach-insights'], queryFn: () => fetchInsights(1) })
  const latest = insights.data?.[0]
  if (!latest) return null

  const pending = latest.proposals.filter((p) => p.status === 'PENDING').length

  return (
    <section className="rounded-xl border border-moss-200 bg-moss-25 p-4 md:p-5 dark:border-moss-750 dark:bg-moss-850">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
          {t('cardTitle', {
            date: format(parseISO(latest.weekStart), 'd MMMM', { locale: dateLocale() }),
          })}
        </h2>
        {pending > 0 && (
          <span className="rounded-full bg-copper-600/15 px-2 py-0.5 text-[11px] font-semibold text-copper-600 dark:bg-copper-300/15 dark:text-copper-300">
            {t('pendingCount', { count: pending })}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line">{latest.prose}</p>
      <Link
        to="/coach"
        className="mt-2 inline-block text-xs font-medium text-pine-700 hover:underline dark:text-pine-300"
      >
        {t('readFull')} →
      </Link>
    </section>
  )
}
