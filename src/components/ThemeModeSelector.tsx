import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme'
import { useRovingRadioGroup } from '../lib/useRovingRadioGroup'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'theme.light' },
  { value: 'system', label: 'theme.auto' },
  { value: 'dark', label: 'theme.dark' },
]

/** Segmented light / auto / dark control for the account menus. */
export function ThemeModeSelector() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)

  function pick(value: ThemeMode) {
    setThemeMode(value)
    setMode(value)
  }

  const radioProps = useRovingRadioGroup(
    MODES.length,
    MODES.findIndex((m) => m.value === mode),
    (index) => pick(MODES[index].value),
  )

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label')}
      className="flex gap-0.5 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800"
    >
      {MODES.map(({ value, label }, index) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          onClick={() => pick(value)}
          {...radioProps(index)}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
            mode === value
              ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
              : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
          }`}
        >
          {t(label)}
        </button>
      ))}
    </div>
  )
}
