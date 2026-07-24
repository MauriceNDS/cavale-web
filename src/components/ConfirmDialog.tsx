import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

/**
 * Confirmation step for consequential actions. Rendered conditionally by the
 * caller (`{confirming && <ConfirmDialog …/>}`); cancel, backdrop and Escape
 * all dismiss without confirming. `danger` paints the confirm button clay for
 * destructive acts, otherwise pine.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('common')
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-moss-500 dark:text-moss-400">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          autoFocus
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-moss-200 px-4 py-2 text-sm font-medium transition hover:bg-moss-100 disabled:opacity-40 dark:border-moss-750 dark:hover:bg-moss-800"
        >
          {t('cancel')}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-moss-25 transition disabled:opacity-40 dark:text-moss-950 ${
            danger
              ? 'bg-clay-600 hover:bg-clay-500 dark:bg-clay-300 dark:hover:bg-clay-500'
              : 'bg-pine-600 hover:bg-pine-700 dark:bg-pine-350 dark:hover:bg-pine-300'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
