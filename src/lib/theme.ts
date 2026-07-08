/** Theme management: light / dark, persisted, class-based (.dark on <html>).
 *  First visit follows the OS preference; after the first toggle the choice sticks. */

export type Theme = 'light' | 'dark'

const THEME_KEY = 'cavale.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return media.matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  apply(theme)
}

/** Call once before render. Follows OS changes only until the user has chosen. */
export function initTheme() {
  apply(getTheme())
  media.addEventListener('change', () => {
    if (!localStorage.getItem(THEME_KEY)) apply(getTheme())
  })
}
