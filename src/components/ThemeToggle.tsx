import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolvedTheme, setThemeMode } from '../lib/theme'

function Icon({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'light') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

/** Quick binary toggle for the public header — the signed-in account menus
 *  expose the full light / dark / system choice instead. */
export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setCurrent] = useState<'light' | 'dark'>(() => resolvedTheme())

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setThemeMode(next)
    setCurrent(next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
      aria-label={theme === 'light' ? t('theme.toDark') : t('theme.toLight')}
      className="grid h-8 w-8 place-items-center rounded-lg text-moss-500 transition hover:bg-moss-100 hover:text-ink dark:text-moss-400 dark:hover:bg-moss-800 dark:hover:text-linen"
    >
      <Icon theme={theme} />
    </button>
  )
}
