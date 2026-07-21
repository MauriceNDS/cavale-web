import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Shared overlay dialog: a bottom sheet on phones (thumb-first, mid-workout),
 * a centered card from sm up. Backdrop tap and Escape close it; the page
 * behind stops scrolling while it's open.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation('common')
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid grid-rows-[1fr_auto] bg-moss-950/50 sm:place-items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="row-start-2 sm:row-start-auto" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-moss-200 bg-moss-25 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:w-[28rem] sm:max-w-[92vw] sm:rounded-xl sm:p-5 dark:border-moss-750 dark:bg-moss-850">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-moss-500 dark:text-moss-400">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
            >
              ✕
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  )
}
