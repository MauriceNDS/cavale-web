import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { ShoeSwatch } from './ShoeSwatch'
import type { ShoeResponse } from './api'

/**
 * Shoe selection with the colours visible — a plain <select> can't render
 * them, and colour is how athletes identify their pairs. Closed: a field-look
 * button with the chosen pair's swatch. Open: the shared Modal as a listbox
 * (bottom sheet on phones), one swatch-led row per pair.
 */
export function ShoePicker({
  shoes,
  value,
  onChange,
  disabled = false,
  label,
}: {
  shoes: ShoeResponse[]
  /** Selected shoe id; null/'' = no shoe. */
  value: string | null
  onChange: (shoeId: string | null) => void
  disabled?: boolean
  /** Field label — also titles the selection sheet. */
  label: string
}) {
  const { t } = useTranslation('calendar')
  const [open, setOpen] = useState(false)
  const selected = shoes.find((s) => s.id === value) ?? null

  function choose(id: string | null) {
    onChange(id)
    setOpen(false)
  }

  const rowClass = (isSelected: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
      isSelected
        ? 'border-pine-600 bg-pine-100/50 dark:border-pine-350 dark:bg-pine-900/40'
        : 'border-moss-200 bg-moss-50 hover:bg-moss-100 dark:border-moss-750 dark:bg-moss-900 dark:hover:bg-moss-800'
    }`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="mt-0.5 flex w-full items-center gap-2 rounded-lg border border-moss-200 bg-moss-100 px-2.5 py-1.5 text-left text-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/25 disabled:opacity-50 dark:border-moss-750 dark:bg-moss-800 dark:focus:border-pine-350 dark:focus:ring-pine-350/25"
      >
        <ShoeSwatch color={selected?.color} colorSecondary={selected?.colorSecondary} size="sm" />
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.name : t('wizard.shoeNone')}
          {selected?.brand && (
            <span className="text-moss-500 dark:text-moss-400"> · {selected.brand}</span>
          )}
        </span>
        <span aria-hidden className="text-xs text-moss-500 dark:text-moss-400">
          ▾
        </span>
      </button>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <ul role="listbox" aria-label={label} className="space-y-1.5">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                onClick={() => choose(null)}
                className={rowClass(!selected)}
              >
                <ShoeSwatch color={null} size="md" />
                <span className="text-moss-500 dark:text-moss-400">{t('wizard.shoeNone')}</span>
              </button>
            </li>
            {shoes.map((shoe) => (
              <li key={shoe.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={shoe.id === value}
                  onClick={() => choose(shoe.id)}
                  className={rowClass(shoe.id === value)}
                >
                  <ShoeSwatch color={shoe.color} colorSecondary={shoe.colorSecondary} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{shoe.name}</span>
                    {shoe.brand && (
                      <span className="block truncate text-xs text-moss-500 dark:text-moss-400">
                        {shoe.brand}
                      </span>
                    )}
                  </span>
                  {shoe.isDefault && (
                    <span aria-hidden className="text-xs text-pine-700 dark:text-pine-300">
                      ★
                    </span>
                  )}
                  {shoe.retired && (
                    <span className="rounded-full bg-moss-100 px-2 py-0.5 text-[11px] font-medium text-moss-500 dark:bg-moss-800 dark:text-moss-400">
                      {t('report.shoeRetired')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
