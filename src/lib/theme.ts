/** Theme management: light / dark / system, persisted, class-based (.dark on <html>).
 *  "system" (the default) follows the OS preference live; an explicit choice sticks. */

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'cavale.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

/** The concrete theme a mode renders as right now. */
export function resolvedTheme(mode: ThemeMode = getThemeMode()): 'light' | 'dark' {
  if (mode === 'system') return media.matches ? 'dark' : 'light'
  return mode
}

function apply() {
  document.documentElement.classList.toggle('dark', resolvedTheme() === 'dark')
}

export function setThemeMode(mode: ThemeMode) {
  if (mode === 'system') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, mode)
  apply()
}

/** Call once before render. Follows OS changes while in system mode. */
export function initTheme() {
  apply()
  media.addEventListener('change', () => {
    if (getThemeMode() === 'system') apply()
  })
}
