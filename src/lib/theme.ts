/** Theme management: light / dark / system, persisted, class-based (.dark on <html>). */

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'cavale.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, theme)
  apply(theme)
}

/** Call once before render: applies the stored theme and tracks OS changes. */
export function initTheme() {
  apply(getTheme())
  media.addEventListener('change', () => {
    if (getTheme() === 'system') apply('system')
  })
}
