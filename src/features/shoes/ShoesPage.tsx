import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale, numberLocale } from '../../i18n'
import { card, muted } from '../../lib/ui'
import { fetchShoeOverview, type ShoeOverviewResponse, type ShoePurpose } from './api'
import { BrandBadge } from './brands'
import { ShoeSwatch } from './ShoeSwatch'

const PURPOSE_BADGE: Record<ShoePurpose, string> = {
  ROAD: 'bg-lake-600/15 text-lake-600 dark:bg-lake-300/15 dark:text-lake-300',
  TRAIL: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  RACE: 'bg-gold-600/15 text-gold-600 dark:bg-gold-300/15 dark:text-gold-300',
}

/** Fallback swatch hues for the rotation strip when a pair has no colour. */
const NEUTRAL_STRIP = ['#8a9a8f', '#b0876a', '#7a8ca0', '#a09a7a']

function formatPace(secPerKm: number | null): string {
  if (secPerKm == null) return '—'
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`
}

/** The shoe rotation in numbers: wear, recent use, and pair-by-pair comparison. */
export function ShoesPage() {
  const { t } = useTranslation('shoes')
  const query = useQuery({ queryKey: ['shoe-overview'], queryFn: fetchShoeOverview })
  const rows = useMemo(() => query.data ?? [], [query.data])

  const active = rows.filter((r) => !r.shoe.retired)
  const retired = rows.filter((r) => r.shoe.retired)
  const anyTagged = rows.some((r) => r.stats.runs > 0)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">{t('page.title')}</h1>
        <Link to="/profil" className="text-sm font-medium text-pine-700 hover:underline dark:text-pine-300">
          {t('page.manage')} →
        </Link>
      </div>
      <p className={`mt-1 text-sm ${muted}`}>{t('page.intro')}</p>

      {query.isSuccess && rows.length === 0 && (
        <p className={`mt-6 text-sm ${muted}`}>{t('page.empty')}</p>
      )}
      {query.isSuccess && rows.length > 0 && !anyTagged && (
        <p className={`mt-6 text-sm ${muted}`}>{t('page.noTagged')}</p>
      )}

      {rows.length > 0 && <RotationStrip rows={rows} />}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {active.map((row) => (
          <PairCard key={row.shoe.id} row={row} />
        ))}
      </div>

      {anyTagged && <CompareTable active={active} retired={retired} />}
    </div>
  )
}

/** Share of the last 90 days' km per pair, as one stacked bar. */
function RotationStrip({ rows }: { rows: ShoeOverviewResponse[] }) {
  const { t } = useTranslation('shoes')
  const used = rows.filter((r) => r.recentKm > 0)
  const total = used.reduce((sum, r) => sum + r.recentKm, 0)

  return (
    <section className={`${card} mt-5`}>
      <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('page.rotation')}
      </h2>
      {total === 0 ? (
        <p className={`mt-2 text-sm ${muted}`}>{t('page.rotationEmpty')}</p>
      ) : (
        <>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-moss-100 dark:bg-moss-800">
            {used.map((r, i) => (
              <div
                key={r.shoe.id}
                title={`${r.shoe.name} — ${r.recentKm.toLocaleString(numberLocale())} km`}
                style={{
                  width: `${(r.recentKm / total) * 100}%`,
                  backgroundColor: r.shoe.color ?? NEUTRAL_STRIP[i % NEUTRAL_STRIP.length],
                }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {used.map((r) => (
              <li key={r.shoe.id} className={`flex items-center gap-1.5 text-xs ${muted}`}>
                <ShoeSwatch color={r.shoe.color} colorSecondary={r.shoe.colorSecondary} size="sm" />
                {r.shoe.name}
                <span className="font-medium tabular-nums">
                  {Math.round((r.recentKm / total) * 100)} %
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** One active pair: identity, wear toward retirement, usage numbers, 6-month shape. */
function PairCard({ row }: { row: ShoeOverviewResponse }) {
  const { t } = useTranslation(['shoes', 'settings'])
  const { shoe, stats } = row
  const wearPct = shoe.retirementKm != null ? (shoe.mileageKm / shoe.retirementKm) * 100 : null
  const maxMonth = Math.max(...stats.monthlyKm.map((m) => m.km), 1)

  return (
    <section className={card}>
      <div className="flex items-center gap-2.5">
        <ShoeSwatch color={shoe.color} colorSecondary={shoe.colorSecondary} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold">{shoe.name}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <BrandBadge brand={shoe.brand} size="sm" />
            {shoe.purpose && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PURPOSE_BADGE[shoe.purpose]}`}>
                {t(`settings:parameters.shoes.purposes.${shoe.purpose}`)}
              </span>
            )}
            {shoe.isDefault && (
              <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-700 dark:bg-pine-900 dark:text-pine-300">
                {t('settings:parameters.shoes.defaultBadge')}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="km" value={stats.totalKm.toLocaleString(numberLocale())} />
        <Stat label={t('page.runs')} value={String(stats.runs)} />
        <Stat label="D+" value={`${stats.totalElevationM.toLocaleString(numberLocale())} m`} />
      </dl>

      {wearPct != null && (
        <div className="mt-3">
          <p className={`flex justify-between text-xs ${muted}`}>
            <span>
              {t('page.wear')}
              {wearPct >= 100 && (
                <span className="ml-1.5 font-semibold text-clay-500 dark:text-clay-300">
                  {t('page.replaceNow')}
                </span>
              )}
              {wearPct >= 85 && wearPct < 100 && (
                <span className="ml-1.5 font-semibold text-gold-600 dark:text-gold-300">
                  {t('page.replaceSoon')}
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {Math.round(shoe.mileageKm)} / {shoe.retirementKm} km
            </span>
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-moss-200 dark:bg-moss-800">
            <div
              className={`h-full rounded-full ${
                wearPct >= 100
                  ? 'bg-clay-500 dark:bg-clay-300'
                  : wearPct >= 85
                    ? 'bg-gold-600 dark:bg-gold-300'
                    : 'bg-pine-600 dark:bg-pine-350'
              }`}
              style={{ width: `${Math.min(wearPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>
          {t('page.monthly')}
        </p>
        <div className="mt-1 flex h-12 items-end gap-1">
          {stats.monthlyKm.map((m) => (
            <div key={m.month} className="flex-1" title={`${m.month} — ${m.km} km`}>
              <div
                className="rounded-t bg-pine-600/70 dark:bg-pine-350/70"
                style={{ height: `${Math.max((m.km / maxMonth) * 48, m.km > 0 ? 3 : 1)}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      <p className={`mt-2 text-xs ${muted}`}>
        {stats.firstUsedOn
          ? t('page.inServiceSince', {
              date: format(parseISO(stats.firstUsedOn), 'd MMM yyyy', { locale: dateLocale() }),
            })
          : t('page.never')}
        {stats.avgPaceSecPerKm != null && <> · {formatPace(stats.avgPaceSecPerKm)}</>}
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-moss-200 bg-moss-50 p-2 dark:border-moss-750 dark:bg-moss-900">
      <dd className="font-display text-base font-semibold tabular-nums">{value}</dd>
      <dt className={`text-[11px] ${muted}`}>{label}</dt>
    </div>
  )
}

type SortKey = 'name' | 'km' | 'runs' | 'pace' | 'dPerKm' | 'lastUsed'

/** Every pair side by side, sortable; retired pairs fold away. */
function CompareTable({
  active,
  retired,
}: {
  active: ShoeOverviewResponse[]
  retired: ShoeOverviewResponse[]
}) {
  const { t } = useTranslation('shoes')
  const [sortKey, setSortKey] = useState<SortKey>('km')
  const [descending, setDescending] = useState(true)
  const [showRetired, setShowRetired] = useState(false)

  const value = (r: ShoeOverviewResponse, key: SortKey): number | string => {
    switch (key) {
      case 'name':
        return r.shoe.name.toLowerCase()
      case 'km':
        return r.stats.totalKm
      case 'runs':
        return r.stats.runs
      // missing pace/date sort AFTER real values whatever the direction
      case 'pace':
        return r.stats.avgPaceSecPerKm ?? (descending ? -1 : Number.MAX_SAFE_INTEGER)
      case 'dPerKm':
        return r.stats.totalKm > 0 ? r.stats.totalElevationM / r.stats.totalKm : 0
      case 'lastUsed':
        return r.stats.lastUsedOn ?? (descending ? '' : '9999')
    }
  }
  const sorted = (rows: ShoeOverviewResponse[]) =>
    [...rows].sort((a, b) => {
      const va = value(a, sortKey)
      const vb = value(b, sortKey)
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
      return descending ? -cmp : cmp
    })

  const header = (key: SortKey, label: string, numeric = true) => (
    <th
      scope="col"
      aria-sort={sortKey === key ? (descending ? 'descending' : 'ascending') : undefined}
      className={`px-2 py-1.5 font-semibold ${numeric ? 'text-right' : 'text-left'}`}
    >
      <button
        onClick={() => {
          if (sortKey === key) setDescending(!descending)
          else {
            setSortKey(key)
            setDescending(key !== 'name')
          }
        }}
        className="inline-flex items-center gap-0.5 hover:text-ink dark:hover:text-linen"
      >
        {label}
        {sortKey === key && <span aria-hidden="true">{descending ? '▾' : '▴'}</span>}
      </button>
    </th>
  )

  const row = (r: ShoeOverviewResponse) => (
    <tr
      key={r.shoe.id}
      className={`border-t border-moss-200 dark:border-moss-750 ${r.shoe.retired ? 'opacity-60' : ''}`}
    >
      <td className="px-2 py-1.5">
        <span className="flex items-center gap-1.5">
          <ShoeSwatch color={r.shoe.color} colorSecondary={r.shoe.colorSecondary} size="sm" />
          <span className="max-w-32 truncate sm:max-w-none">{r.shoe.name}</span>
        </span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {r.stats.totalKm.toLocaleString(numberLocale())}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.stats.runs}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatPace(r.stats.avgPaceSecPerKm)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {r.stats.totalKm > 0 ? `${Math.round(r.stats.totalElevationM / r.stats.totalKm)} m` : '—'}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {r.stats.lastUsedOn
          ? format(parseISO(r.stats.lastUsedOn), 'd MMM', { locale: dateLocale() })
          : '—'}
      </td>
    </tr>
  )

  return (
    <section className={`${card} mt-4`}>
      <h2 className="text-xs font-semibold tracking-wide text-moss-500 uppercase dark:text-moss-400">
        {t('page.compare')}
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-xs ${muted}`}>
              {header('name', t('page.table.pair'), false)}
              {header('km', t('page.table.km'))}
              {header('runs', t('page.table.runs'))}
              {header('pace', t('page.table.pace'))}
              {header('dPerKm', t('page.table.dPerKm'))}
              {header('lastUsed', t('page.table.lastUsed'))}
            </tr>
          </thead>
          <tbody>
            {sorted(active).map(row)}
            {showRetired && sorted(retired).map(row)}
          </tbody>
        </table>
      </div>
      {retired.length > 0 && (
        <button
          onClick={() => setShowRetired(!showRetired)}
          aria-expanded={showRetired}
          className={`mt-2 text-xs font-medium ${muted} hover:text-ink dark:hover:text-linen`}
        >
          {showRetired ? '▾' : '▸'} {t('page.showRetired', { count: retired.length })}
        </button>
      )}
    </section>
  )
}
