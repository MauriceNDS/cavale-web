import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../lib/api'
import { pushSessionToGarmin } from '../intervals/api'
import { downloadSessionFit, type SessionResponse } from './api'

/**
 * Export: one button, two destinations — a .fit file download, or a direct
 * push to Garmin Connect through the athlete's Intervals.icu link. Owns its
 * whole flow (download state, push mutation, hints), so any screen can drop
 * it next to a session. `direction` says where the menu opens: 'up' for the
 * sticky bottom action bar of the session page, 'down' when the button sits
 * near the top of the page (home).
 */
export function ExportMenu({
  session,
  direction = 'up',
}: {
  session: SessionResponse
  direction?: 'up' | 'down'
}) {
  const { t } = useTranslation('calendar')
  const [open, setOpen] = useState(false)
  const [exportingFit, setExportingFit] = useState(false)
  const [exportedFit, setExportedFit] = useState(false)

  const garmin = useMutation({
    mutationFn: () => pushSessionToGarmin(session.id),
    onSuccess: () => setOpen(false),
  })
  const problem = garmin.error instanceof ApiError ? garmin.error.problem : undefined

  async function exportFit() {
    setOpen(false)
    setExportingFit(true)
    try {
      await downloadSessionFit(session)
      setExportedFit(true) // surface the "how to get it onto the watch" hint
    } finally {
      setExportingFit(false)
    }
  }

  const itemClass =
    'block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-moss-100 disabled:opacity-50 dark:text-linen dark:hover:bg-moss-800'
  const menuPosition =
    direction === 'up' ? 'bottom-full left-0 mb-1' : 'top-full right-0 mt-1'

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="rounded-lg border border-moss-200 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-moss-100 dark:border-moss-750 dark:text-linen dark:hover:bg-moss-800"
        >
          {t('session.export')}
        </button>
        {open && (
          <div
            role="menu"
            className={`absolute z-40 w-56 rounded-lg border border-moss-200 bg-moss-25 p-1 shadow-lg dark:border-moss-750 dark:bg-moss-850 ${menuPosition}`}
          >
            <button
              role="menuitem"
              onClick={() => void exportFit()}
              disabled={exportingFit}
              className={itemClass}
            >
              {exportingFit ? t('session.exporting') : t('session.exportFit')}
            </button>
            <button
              role="menuitem"
              onClick={() => garmin.mutate()}
              disabled={garmin.isPending}
              className={itemClass}
            >
              {garmin.isPending ? t('session.exporting') : t('session.exportGarmin')}
            </button>
          </div>
        )}
      </div>
      {exportedFit && (
        <p className="w-full text-xs text-moss-500 dark:text-moss-400">{t('session.exportFitHint')}</p>
      )}
      {garmin.isSuccess && (
        <p role="status" className="w-full text-xs text-pine-700 dark:text-pine-300">
          {t('session.exportGarminDone')}
        </p>
      )}
      {problem && (
        <p role="alert" className="w-full text-xs text-clay-500 dark:text-clay-300">
          {problem.detail ?? problem.title}
        </p>
      )}
    </>
  )
}
