import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { useAuth } from '../auth/session'
import { fetchActivities, type FeedFilters, type FeedItem, type FeedType } from './api'

const muted = 'text-moss-500 dark:text-moss-400'
const fieldClass =
  'rounded-lg border border-moss-200 bg-moss-100 px-3 py-1.5 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

const PAGE_SIZE = 20

function formatPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

/** The whole history: searchable by name and date range, page by page. */
export function ActivitiesPage() {
  const { t } = useTranslation('athlete')
  const { user } = useAuth()
  const [type, setType] = useState<FeedType>('ALL')
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filters: FeedFilters = { q, from: from || undefined, to: to || undefined }
  const query = useQuery({
    queryKey: ['activities', type, page, q, from, to],
    queryFn: () => fetchActivities(type, page, filters),
    placeholderData: (previous) => previous,
  })

  const data = query.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const filterTypes: { value: FeedType; label: string }[] = [
    { value: 'ALL', label: t('activities.filterAll') },
    { value: 'RUN', label: t('activities.filterRun') },
    ...(user?.gymEnabled ? [{ value: 'GYM' as FeedType, label: t('activities.filterGym') }] : []),
  ]

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(0)
    }
  }

  const byMonth = new Map<string, FeedItem[]>()
  for (const item of data?.items ?? []) {
    const key = format(parseISO(item.date), 'MMMM yyyy', { locale: dateLocale() })
    byMonth.set(key, [...(byMonth.get(key) ?? []), item])
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('activities.title')}</h1>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {filterTypes.map((filter) => (
            <button
              key={filter.value}
              onClick={() => resetPage(setType)(filter.value)}
              aria-pressed={type === filter.value}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                type === filter.value
                  ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
                  : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(event) => resetPage(setQ)(event.target.value)}
          placeholder={t('activities.searchPlaceholder')}
          aria-label={t('activities.searchAria')}
          className={`${fieldClass} w-full sm:w-56`}
        />
        <label className={`flex items-center gap-1.5 text-xs ${muted}`}>
          {t('activities.from')}
          <input type="date" value={from} aria-label={t('activities.fromAria')}
            onChange={(event) => resetPage(setFrom)(event.target.value)} className={fieldClass} />
        </label>
        <label className={`flex items-center gap-1.5 text-xs ${muted}`}>
          {t('activities.to')}
          <input type="date" value={to} aria-label={t('activities.toAria')}
            onChange={(event) => resetPage(setTo)(event.target.value)} className={fieldClass} />
        </label>
        {(q || from || to) && (
          <button
            onClick={() => {
              setQ('')
              setFrom('')
              setTo('')
              setPage(0)
            }}
            className="text-xs font-medium text-pine-700 underline dark:text-pine-300"
          >
            {t('activities.clear')}
          </button>
        )}
        {data && (
          <span className={`ml-auto text-xs ${muted}`}>
            {t('activities.count', { count: data.total })}
          </span>
        )}
      </div>

      {query.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          {t('activities.loadError')}
        </p>
      )}
      {query.isLoading && <p className={`mt-8 text-center ${muted}`}>{t('common:loading')}</p>}
      {data && data.items.length === 0 && (
        <p className={`mt-8 text-center ${muted}`}>{t('activities.empty')}</p>
      )}

      {[...byMonth.entries()].map(([month, monthItems]) => (
        <section key={month} className="mt-5">
          <h2 className={`text-xs font-semibold tracking-wide uppercase ${muted}`}>{month}</h2>
          <div className="mt-2 space-y-1.5">
            {monthItems.map((item) => (
              <FeedRow key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ))}

      {data && totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3" aria-label={t('activities.paginationAria')}>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            className="rounded-lg border border-moss-200 px-3.5 py-1.5 text-sm font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:border-moss-750 dark:hover:bg-moss-800"
          >
            {t('activities.previous')}
          </button>
          <span className={`text-sm tabular-nums ${muted}`}>
            {t('activities.pageOf', { page: page + 1, total: totalPages })}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!data.hasMore}
            className="rounded-lg border border-moss-200 px-3.5 py-1.5 text-sm font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:border-moss-750 dark:hover:bg-moss-800"
          >
            {t('activities.next')}
          </button>
        </nav>
      )}
    </div>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const { t } = useTranslation('athlete')
  const isRun = item.type === 'RUN'
  const facts = isRun
    ? [
        item.distanceKm != null ? `${item.distanceKm} km` : null,
        item.durationMin != null ? formatDuration(item.durationMin) : null,
        item.paceSecPerKm != null ? formatPace(item.paceSecPerKm) : null,
        item.elevationM ? `${item.elevationM} m D+` : null,
        item.avgHr ? `${item.avgHr} bpm` : null,
      ]
    : [
        item.durationMin != null ? formatDuration(item.durationMin) : null,
        item.tonnageKg != null && item.tonnageKg > 0 ? t('activities.lifted', { count: item.tonnageKg }) : null,
        item.sets ? t('activities.sets', { count: item.sets }) : null,
      ]

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${
          isRun ? 'bg-pine-100 dark:bg-pine-900' : 'bg-copper-600/15 dark:bg-copper-300/15'
        }`}
      >
        {isRun ? '🏃' : '🏋'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {item.title ?? (isRun ? t('activities.runFallback') : t('activities.gymFallback'))}
          {item.painFlag && (
            <span className="ml-1.5 text-xs text-clay-500 dark:text-clay-300" title={t('activities.painTitle')}>
              {t('activities.pain')}
            </span>
          )}
        </p>
        <p className={`truncate text-xs ${muted}`}>
          {format(parseISO(item.date), 'EEE d MMM', { locale: dateLocale() })}
          {isRun && item.source === 'STRAVA' && !item.sessionId && ` · ${t('activities.offPlan')}`}
          {facts.filter(Boolean).length > 0 && ` · ${facts.filter(Boolean).join(' · ')}`}
        </p>
      </div>
    </>
  )

  const className =
    'flex items-center gap-3 rounded-lg border border-moss-200 bg-moss-25 p-2.5 transition hover:border-pine-600/40 dark:border-moss-750 dark:bg-moss-850 dark:hover:border-pine-350/40'

  if (isRun && item.sessionId) {
    return (
      <Link to="/session/$sessionId" params={{ sessionId: item.sessionId }} className={className}>
        {content}
      </Link>
    )
  }
  if (!isRun) {
    return (
      <Link to="/entrainement/$workoutId" params={{ workoutId: item.id }} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}
