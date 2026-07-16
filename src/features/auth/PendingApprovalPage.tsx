import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthCard } from '../../components/form'
import type { AccountStatus } from './api'
import { useAuth } from './session'

/**
 * Shown to a signed-in account that is not yet ACTIVE. A PENDING account is
 * waiting for an admin to approve it; a DISABLED one has been turned off. Both
 * can do nothing but re-check their status or sign out.
 */
export function PendingApprovalPage({
  status,
  email,
}: {
  status: AccountStatus
  email: string
}) {
  const { t } = useTranslation('auth')
  const { logout, refresh } = useAuth()
  const [rechecking, setRechecking] = useState(false)

  const disabled = status === 'DISABLED'

  async function recheck() {
    setRechecking(true)
    try {
      await refresh()
    } finally {
      setRechecking(false)
    }
  }

  return (
    <AuthCard
      title={t(disabled ? 'pending.disabledTitle' : 'pending.pendingTitle')}
      subtitle={t('pending.signedInAs', { email })}
    >
      <div
        role="status"
        className={`mt-6 rounded-lg border p-4 text-sm ${
          disabled
            ? 'border-clay-300/50 bg-clay-100 text-clay-600 dark:border-clay-600/50 dark:bg-clay-900 dark:text-clay-300'
            : 'border-moss-200 bg-moss-100 text-ink dark:border-moss-750 dark:bg-moss-800 dark:text-linen'
        }`}
      >
        {t(disabled ? 'pending.disabledBody' : 'pending.pendingBody')}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {!disabled && (
          <button
            onClick={recheck}
            disabled={rechecking}
            className="w-full rounded-lg bg-pine-600 px-4 py-2.5 font-semibold text-moss-25 transition hover:bg-pine-700 disabled:opacity-50 dark:bg-pine-350 dark:text-moss-950 dark:hover:bg-pine-300"
          >
            {t('pending.recheck')}
          </button>
        )}
        <button
          onClick={logout}
          className="w-full rounded-lg border border-moss-200 px-4 py-2.5 text-sm font-medium text-moss-500 transition hover:bg-moss-100 dark:border-moss-750 dark:text-moss-400 dark:hover:bg-moss-800"
        >
          {t('pending.signOut')}
        </button>
      </div>
    </AuthCard>
  )
}
