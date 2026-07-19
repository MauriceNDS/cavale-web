import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { dateLocale } from '../../i18n'
import { ApiError } from '../../lib/api'
import { muted } from '../../lib/ui'
import type { AccountStatus } from '../auth/api'
import { useAuth } from '../auth/session'
import {
  activateUser,
  deactivateUser,
  fetchUsers,
  type AdminUser,
  type StatusFilter,
} from './api'

const STATUS_BADGE: Record<AccountStatus, string> = {
  PENDING: 'bg-copper-600/15 text-copper-600 dark:bg-copper-300/15 dark:text-copper-300',
  ACTIVE: 'bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300',
  DISABLED: 'bg-clay-100 text-clay-600 dark:bg-clay-900 dark:text-clay-300',
}

interface FilterTab {
  key: string
  filter: StatusFilter
  label: string
}

const TABS: FilterTab[] = [
  { key: 'all', filter: null, label: 'filters.all' },
  { key: 'pending', filter: 'PENDING', label: 'filters.pending' },
  { key: 'active', filter: 'ACTIVE', label: 'filters.active' },
  { key: 'disabled', filter: 'DISABLED', label: 'filters.disabled' },
]

/** Admin console: every account, filterable by access status, with one-click
 *  activate / deactivate. Admin-only — non-admins are bounced home. */
export function UsersAdminPage() {
  const { t } = useTranslation('admin')
  const { user } = useAuth()
  const navigate = useNavigate()

  // Belt-and-suspenders with the server gate: never render the console to a
  // non-admin who reaches /admin by URL.
  useEffect(() => {
    if (user && user.role !== 'ADMIN') void navigate({ to: '/' })
  }, [user, navigate])

  const search = useSearch({ strict: false }) as { status?: string }
  const active = TABS.find((tab) => tab.key === search.status) ?? TABS[0]

  const query = useQuery({
    queryKey: ['admin', 'users', active.filter],
    queryFn: () => fetchUsers(active.filter),
    enabled: user?.role === 'ADMIN',
  })

  if (!user || user.role !== 'ADMIN') return null

  const users = query.data ?? []

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <header>
        <h1 className="font-display text-2xl font-semibold">{t('title')}</h1>
        <p className={`mt-1 text-sm ${muted}`}>{t('subtitle')}</p>
      </header>

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t('title')}>
        {TABS.map((tab) => {
          const selected = tab.key === active.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              onClick={() =>
                navigate({ to: '/admin', search: tab.filter ? { status: tab.key } : {} })
              }
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? 'bg-pine-600 text-moss-25 dark:bg-pine-350 dark:text-moss-950'
                  : 'border border-moss-200 text-moss-500 hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800'
              }`}
            >
              {t(tab.label)}
            </button>
          )
        })}
      </div>

      {query.isLoading && <p className={`mt-8 text-center ${muted}`}>{t('common:loading')}</p>}
      {query.isError && (
        <p className="mt-8 text-center text-clay-500 dark:text-clay-300">{t('loadError')}</p>
      )}

      {query.data && (
        <>
          <p className={`mt-4 text-xs ${muted}`}>{t('count', { count: users.length })}</p>
          {users.length === 0 ? (
            <p className={`mt-8 text-center ${muted}`}>{t('empty')}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {users.map((account) => (
                <UserRow key={account.id} account={account} isSelf={account.id === user.id} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function UserRow({ account, isSelf }: { account: AdminUser; isSelf: boolean }) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (next: 'activate' | 'deactivate') =>
      next === 'activate' ? activateUser(account.id) : deactivateUser(account.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const isAdmin = account.role === 'ADMIN'
  // Admins can't be deactivated (server enforces it too), so only offer the
  // action that makes sense for the current status.
  const action: 'activate' | 'deactivate' | null = isAdmin
    ? null
    : account.accountStatus === 'ACTIVE'
      ? 'deactivate'
      : 'activate'

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-moss-200 bg-moss-25 p-3 dark:border-moss-750 dark:bg-moss-850">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-600 text-sm font-semibold text-moss-25 dark:bg-pine-350 dark:text-moss-950">
        {(account.displayName || account.email).charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{account.displayName}</p>
          {isAdmin && (
            <span className={`rounded-full bg-moss-100 px-2 py-0.5 text-[11px] font-medium ${muted} dark:bg-moss-800`}>
              {t('role.ADMIN')}
            </span>
          )}
          {isSelf && (
            <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-medium text-pine-700 dark:bg-pine-900 dark:text-pine-300">
              {t('you')}
            </span>
          )}
        </div>
        <p className={`truncate text-xs ${muted}`}>
          {account.email} · {t('joinedOn', { date: format(new Date(account.createdAt), 'd MMM yyyy', { locale: dateLocale() }) })}
        </p>
        {mutation.isError && (
          <p role="alert" className="mt-1 text-xs text-clay-500 dark:text-clay-300">
            {mutation.error instanceof ApiError ? mutation.error.message : t('actionError')}
          </p>
        )}
      </div>

      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[account.accountStatus]}`}
      >
        {t(`status.${account.accountStatus}`)}
      </span>

      {action && (
        <button
          onClick={() => mutation.mutate(action)}
          disabled={mutation.isPending}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            action === 'activate'
              ? 'bg-pine-600 text-moss-25 hover:bg-pine-700 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300'
              : 'border border-clay-500/40 text-clay-500 hover:bg-clay-100 dark:text-clay-300 dark:hover:bg-clay-900'
          }`}
        >
          {mutation.isPending
            ? t(action === 'activate' ? 'actions.activating' : 'actions.deactivating')
            : t(action === 'activate' ? 'actions.activate' : 'actions.deactivate')}
        </button>
      )}
    </li>
  )
}
