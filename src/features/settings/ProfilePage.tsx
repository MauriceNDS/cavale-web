import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { updateProfile, updateStatus } from '../athlete/api'
import { fetchMe, type AthleteStatus } from '../auth/api'

const STATUSES: AthleteStatus[] = ['AVAILABLE', 'INJURED', 'RECOVERING', 'SICK']

/** General athlete information — app behaviour and integrations live in Paramètres. */
export function ProfilePage() {
  const { t } = useTranslation('settings')
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <h1 className="font-display text-2xl font-semibold">{t('profile.title')}</h1>

      <ProfileCard />
      <StatusCard />
    </div>
  )
}

/** Availability — the one signal plan creation (manual or MCP) must respect. */
function StatusCard() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const [status, setStatus] = useState<AthleteStatus | null>(null)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: updateStatus,
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['hub'] })
    },
  })

  const user = me.data
  if (!user) return null
  const selected = status ?? user.athleteStatus

  const chip = (value: AthleteStatus) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
      selected === value
        ? value === 'AVAILABLE'
          ? 'border-pine-600 bg-pine-100 text-pine-700 dark:border-pine-350 dark:bg-pine-900 dark:text-pine-300'
          : 'border-clay-500 bg-clay-100 text-clay-600 dark:border-clay-300 dark:bg-clay-900 dark:text-clay-300'
        : 'border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
    }`

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('profile.status.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">
        {t('profile.status.intro')}
        {user.athleteStatus !== 'AVAILABLE' && user.statusSince && (
          <>
            {' '}
            {t('profile.status.since', {
              date: format(parseISO(user.statusSince), 'd MMMM', { locale: dateLocale() }),
            })}
          </>
        )}
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          setSaved(false)
          const note = (new FormData(event.currentTarget).get('note') as string).trim()
          mutation.mutate({ status: selected, note: note || undefined })
        }}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('profile.status.title')}>
          {STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected === value}
              onClick={() => {
                setStatus(value)
                setSaved(false)
              }}
              className={chip(value)}
            >
              {t(`profile.status.${value}`)}
            </button>
          ))}
        </div>
        <input
          name="note"
          maxLength={500}
          defaultValue={user.statusNote ?? ''}
          placeholder={t('profile.status.notePlaceholder')}
          className="w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
        />
        {mutation.error instanceof ApiError && (
          <p role="alert" className="text-sm text-clay-500 dark:text-clay-300">
            {mutation.error.message}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {mutation.isPending ? t('common:saving') : t('common:save')}
          </button>
          {saved && (
            <span role="status" className="text-sm text-pine-700 dark:text-pine-300">
              {t('profile.status.saved')}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}

function ProfileCard() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['hub'] })
    },
  })

  const user = me.data
  const fieldClass =
    'mt-1 w-full rounded-lg border border-moss-200 bg-moss-100 px-3 py-2 text-sm transition outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25'

  return (
    <section className="mt-6 rounded-xl border border-moss-200 bg-moss-25 p-6 dark:border-moss-750 dark:bg-moss-850">
      <h2 className="font-display text-lg font-semibold">{t('profile.athlete.title')}</h2>
      <p className="mt-0.5 text-sm text-moss-500 dark:text-moss-400">{t('profile.athlete.intro')}</p>

      {me.isLoading && <p className="mt-4 text-sm text-moss-500 dark:text-moss-400">{t('common:loading')}</p>}

      {user && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            setSaved(false)
            const data = new FormData(event.currentTarget)
            const num = (name: string) => {
              const value = (data.get(name) as string | null)?.trim().replace(',', '.')
              return value ? Number(value) : null
            }
            mutation.mutate({
              displayName: (data.get('displayName') as string).trim(),
              weightKg: num('weightKg'),
              heightCm: num('heightCm'),
              birthDate: ((data.get('birthDate') as string) || '').trim() || null,
              maxHr: num('maxHr'),
              restingHr: num('restingHr'),
            })
          }}
        >
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">{t('profile.athlete.displayName')}</span>
            <input name="displayName" required maxLength={100} defaultValue={user.displayName} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('profile.athlete.weight')}</span>
            <input name="weightKg" type="number" step="0.1" min="0" defaultValue={user.weightKg ?? ''} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('profile.athlete.height')}</span>
            <input name="heightCm" type="number" min="0" defaultValue={user.heightCm ?? ''} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('profile.athlete.birthDate')}</span>
            <input name="birthDate" type="date" defaultValue={user.birthDate ?? ''} className={fieldClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">{t('profile.athlete.maxHr')}</span>
              <input name="maxHr" type="number" min="0" defaultValue={user.maxHr ?? ''} className={fieldClass} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('profile.athlete.restingHr')}</span>
              <input name="restingHr" type="number" min="0" defaultValue={user.restingHr ?? ''} className={fieldClass} />
            </label>
          </div>
          {mutation.error instanceof ApiError && (
            <p role="alert" className="text-sm text-clay-500 sm:col-span-2 dark:text-clay-300">
              {mutation.error.message}
            </p>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-pine-600 px-4 py-2 text-sm font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
            >
              {mutation.isPending ? t('common:saving') : t('common:save')}
            </button>
            {saved && (
              <span role="status" className="text-sm text-pine-700 dark:text-pine-300">
                {t('profile.athlete.saved')}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
