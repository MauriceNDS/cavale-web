import { useState } from 'react'
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Auto' },
  { value: 'dark', label: 'Sombre' },
]

/** Segmented light / auto / dark control for the account menus. */
export function ThemeModeSelector() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)

  function pick(value: ThemeMode) {
    setThemeMode(value)
    setMode(value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="flex gap-0.5 rounded-lg bg-moss-100 p-0.5 dark:bg-moss-800"
    >
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          onClick={() => pick(value)}
          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
            mode === value
              ? 'bg-moss-25 text-ink shadow-sm dark:bg-moss-850 dark:text-linen'
              : 'text-moss-500 hover:text-ink dark:text-moss-400 dark:hover:text-linen'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
