import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { fetchActivities, type FeedItem, type FeedType } from './api'

const muted = 'text-moss-500 dark:text-moss-400'

const FILTERS: { value: FeedType; label: string }[] = [
  { value: 'ALL', label: 'Tout' },
  { value: 'RUN', label: 'Course' },
  { value: 'GYM', label: 'Renfo' },
]

function formatPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

/** The whole history in one feed: runs (Strava or manual) and gym workouts. */
export function ActivitiesPage() {
  const [type, setType] = useState<FeedType>('ALL')

  const query = useInfiniteQuery({
    queryKey: ['activities', type],
    queryFn: ({ pageParam }) => fetchActivities(type, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

  const loading = query.isLoading || query.isFetchingNextPage
  const error = query.isError
  const items = (query.data?.pages ?? []).flatMap((p) => p.items)
  const hasMore = query.hasNextPage

  const byMonth = new Map<string, FeedItem[]>()
  for (const item of items) {
    const key = format(parseISO(item.date), 'MMMM yyyy', { locale: fr })
    byMonth.set(key, [...(byMonth.get(key) ?? []), item])
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Activités</h1>
        <div className="flex gap-1 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setType(filter.value)}
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

      {error && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">
          Impossible de charger les activités.
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className={`mt-8 text-center ${muted}`}>Aucune activité pour ce filtre.</p>
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

      {loading && <p className={`mt-6 text-center ${muted}`}>Chargement…</p>}
      {hasMore && !loading && (
        <button
          onClick={() => void query.fetchNextPage()}
          className="mt-5 w-full rounded-lg border border-moss-200 px-4 py-2.5 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          Voir plus
        </button>
      )}
    </div>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
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
        item.tonnageKg != null && item.tonnageKg > 0 ? `${item.tonnageKg} kg soulevés` : null,
        item.sets ? `${item.sets} séries` : null,
      ]

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${
          isRun
            ? 'bg-pine-100 dark:bg-pine-900'
            : 'bg-copper-600/15 dark:bg-copper-300/15'
        }`}
      >
        {isRun ? '🏃' : '🏋'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {item.title ?? (isRun ? 'Sortie' : 'Renfo')}
          {item.painFlag && (
            <span className="ml-1.5 text-xs text-clay-500 dark:text-clay-300" title="Douleur signalée">
              ⚠ douleur
            </span>
          )}
        </p>
        <p className={`truncate text-xs ${muted}`}>
          {format(parseISO(item.date), 'EEE d MMM', { locale: fr })}
          {isRun && item.source === 'STRAVA' && !item.sessionId && ' · Strava (hors plan)'}
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
